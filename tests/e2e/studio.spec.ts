import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { elementColorGroups, elementFontGroups, type FontFamily, fontFamilyCss, fonts } from '../../src/lib/model';

const id = `e2e-${Date.now()}`;
const read = (file: string) => fs.readFile(`content/cv/${file}`, 'utf8').catch(() => '');
// Local tests edit the base too, and autosave writes it to content/cv; restore it after each test.
const baseFiles = ['base.md', 'base.layout.json', 'base.meta.json'];
let baseSnapshot: (string | undefined)[] = [];
test.beforeAll(async () => {
  baseSnapshot = await Promise.all(baseFiles.map((f) => fs.readFile(`content/cv/${f}`, 'utf8').catch(() => undefined)));
});
test.afterEach(async ({ page }) => {
  // Let pending autosaves reach the disk before restoring.
  await page.waitForTimeout(1200);
  await page.close();
  await Promise.all(
    baseFiles.map((f, i) =>
      baseSnapshot[i] === undefined
        ? fs.rm(`content/cv/${f}`, { force: true })
        : fs.writeFile(`content/cv/${f}`, baseSnapshot[i] as string),
    ),
  );
});
test.afterAll(async () => {
  await Promise.all(
    ['md', 'layout.json', 'meta.json'].map((ext) => fs.rm(path.join('content/cv', `${id}.${ext}`), { force: true })),
  );
});

test('cria versão, edita Markdown e tokens, grava arquivos e detecta conflito', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
  await expect(page.locator('.resume h1')).toHaveText('Felipe Rangel Ribeiro');
  await page.getByRole('button', { name: 'Nova Versão', exact: true }).click();
  await page.getByLabel('Nome da versão').fill(id);
  await page.getByRole('button', { name: 'Criar versão', exact: true }).click();
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
  await page
    .getByLabel('Editar código Markdown')
    .fill(
      '# Felipe Rangel Ribeiro\n\n## Backend\n\n- Node.js e AWS\n\n[GitHub](https://github.com/Yokuny)\n\n<script>alert("xss")</script>',
    );
  await expect(page.locator('.resume h2')).toHaveText('Backend');
  await expect(page.locator('.resume script')).toHaveCount(0);
  await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click();
  await page.getByLabel('Família da fonte', { exact: true }).selectOption('Georgia');
  await page.getByLabel('Cor de destaque').fill('#334455');
  await expect(page.getByRole('button', { name: 'Justificar texto', exact: true })).toBeDisabled();
  await page.locator('.resume li').evaluate((element) => {
    const range = document.createRange();
    const text = element.firstChild;
    const selection = window.getSelection();
    if (!text || !selection) throw new Error('Texto não selecionável');
    range.setStart(text, 0);
    range.setEnd(text, 4);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await expect(page.getByRole('button', { name: 'Justificar texto', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Justificar texto', exact: true }).click();
  await expect(page.locator('.resume li')).toHaveCSS('text-align', 'justify');
  await expect(page.locator('.resume h1')).toHaveCSS('text-align', 'start');
  await expect(page.locator('.resume')).toHaveCSS('font-family', 'Georgia, serif');
  await page.getByRole('spinbutton', { name: 'Tamanho do texto' }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.resume')).toHaveCSS('font-size', '14px');
  const previewWidth = await page.locator('.workspace').evaluate((el) => el.clientWidth);
  await page.getByRole('button', { name: 'Fechar menu lateral' }).click();
  await expect(page.locator('.sidebar')).toBeHidden();
  expect(await page.locator('.workspace').evaluate((el) => el.clientWidth)).toBeGreaterThan(previewWidth);
  await page.getByRole('button', { name: 'Abrir menu lateral' }).click();
  await expect(page.getByLabel('Família da fonte', { exact: true })).toHaveValue('Georgia');
  await expect(page.locator('.resume h2')).toHaveText('Backend');
  await expect.poll(() => read(`${id}.md`)).toContain('Node.js e AWS');
  await expect
    .poll(async () => JSON.parse((await read(`${id}.layout.json`)) || '{}').blockAlignments)
    .toEqual([expect.objectContaining({ align: 'justify' })]);
  expect(JSON.parse(await read(`${id}.layout.json`)).accentColor).toBe('#334455');
  await page.reload();
  await page.getByRole('tab', { name: id, exact: true }).click();
  await expect(page.locator('.resume li')).toHaveCSS('text-align', 'justify');
  const all = await (await request.get('/api/resumes')).json();
  const persisted = all.find((v: { id: string }) => v.id === id);
  const { revision, ...resume } = persisted;
  expect(resume).not.toHaveProperty('job');
  const metaPath = `content/cv/${id}.meta.json`;
  expect(JSON.parse(await fs.readFile(metaPath, 'utf8'))).not.toHaveProperty('job');
  // A pending draft from the previous schema still has its old revision.
  await fs.writeFile(metaPath, JSON.stringify({ name: resume.name, job: 'Contexto antigo' }));
  const legacyRevision = createHash('sha256')
    .update(
      JSON.stringify({
        id: resume.id,
        markdown: resume.markdown,
        layout: resume.layout,
        name: resume.name,
        job: 'Contexto antigo',
      }),
    )
    .digest('hex');
  const migrated = await request.post('/api/resumes', {
    data: { resume, expectedRevision: legacyRevision },
  });
  expect(migrated.status()).toBe(200);
  expect(JSON.parse(await fs.readFile(metaPath, 'utf8'))).toEqual({ name: resume.name });
  const externallyEdited = await request.post('/api/resumes', {
    data: { resume: { ...resume, markdown: '# Alterado no disco' }, expectedRevision: revision },
  });
  expect(externallyEdited.status()).toBe(200);
  const staleSave = await request.post('/api/resumes', {
    data: { resume, expectedRevision: revision },
  });
  expect(staleSave.status()).toBe(409);
  const staleDelete = await request.delete('/api/resumes', {
    data: { id, expectedRevision: revision },
  });
  expect(staleDelete.status()).toBe(409);
  const invalidDelete = await request.delete('/api/resumes', {
    data: { id: '../../escape', expectedRevision: null },
  });
  expect(invalidDelete.status()).toBe(400);
  const foreignDelete = await request.delete('/api/resumes', {
    headers: { Origin: 'https://example.com' },
    data: { id, expectedRevision: revision },
  });
  expect(foreignDelete.status()).toBe(403);
  const invalid = await request.post('/api/resumes', {
    data: { resume: { ...resume, id: '../../escape' }, expectedRevision: null },
  });
  expect(invalid.status()).toBe(400);
  const crossOrigin = await request.post('/api/resumes', {
    headers: { Origin: 'https://example.com' },
    data: { resume, expectedRevision: revision },
  });
  expect(crossOrigin.status()).toBe(403);
  expect(errors).toEqual([]);
});

test('aba é arquivo: acompanha alterações externas e resolve conflitos', async ({ page }) => {
  const name = `${id}-sync`;
  const external = `${id}-agente`;
  const all = [name, external].flatMap((v) =>
    ['md', 'layout.json', 'meta.json'].map((ext) => `content/cv/${v}.${ext}`),
  );
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
    await page.getByRole('button', { name: 'Nova Versão', exact: true }).click();
    await page.getByLabel('Nome da versão').fill(name);
    await page.getByRole('button', { name: 'Criar versão', exact: true }).click();
    const tab = page.getByRole('tab', { name, exact: true });
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(JSON.parse(await read(`${name}.meta.json`))).toEqual({ name });
    // An agent edits the open version: a clean tab follows the file.
    await fs.writeFile(`content/cv/${name}.md`, '# Felipe Rangel Ribeiro\n\n## Editado pela IA\n');
    await expect(page.locator('.resume h2')).toHaveText(['Editado pela IA']);
    // A version created outside the interface opens as a new tab.
    await fs.writeFile(`content/cv/${external}.md`, '# Felipe Rangel Ribeiro\n\n## Vaga externa\n');
    await fs.writeFile(`content/cv/${external}.meta.json`, JSON.stringify({ name: external }));
    await expect(page.getByRole('tab', { name: external, exact: true })).toBeVisible();
    // Unsaved edits and a concurrent change on disk become a conflict.
    await page.route('/api/resumes', (route) =>
      route.request().method() === 'POST' ? route.abort() : route.fallback(),
    );
    await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
    await page.getByLabel('Editar código Markdown').fill('# Felipe Rangel Ribeiro\n\n## Minha edição\n');
    await expect(page.getByRole('status')).toBeVisible();
    await fs.writeFile(`content/cv/${name}.md`, '# Felipe Rangel Ribeiro\n\n## Nova edição da IA\n');
    const banner = page.getByRole('alert').filter({ hasText: 'mudou no disco' });
    await expect(banner).toBeVisible();
    await page.unroute('/api/resumes');
    await banner.getByRole('button', { name: 'Recarregar do arquivo' }).click();
    await expect(banner).toBeHidden();
    await expect(page.getByLabel('Editar código Markdown')).toHaveValue(/Nova edição da IA/);
    // Removing the files closes the tab.
    await Promise.all(['md', 'meta.json'].map((ext) => fs.rm(`content/cv/${external}.${ext}`)));
    await expect(page.getByRole('tab', { name: external, exact: true })).toHaveCount(0);
  } finally {
    await Promise.all(all.map((file) => fs.rm(file, { force: true })));
  }
});

test('restaura rascunho e aplica impressão A4 sem a interface', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
  await page
    .getByLabel('Editar código Markdown')
    .fill('# Rascunho persistente\n\nTexto para testar.\n\n[Link](https://github.com/Yokuny)');
  await page.reload();
  await expect(page.locator('.resume h1')).toHaveText('Rascunho persistente');
  await expect.poll(() => read('base.md')).toContain('# Rascunho persistente');
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true';
    };
  });
  await page.getByRole('button', { name: /^Export$/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.app-header')).toBeHidden();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.resume')).toHaveCSS('transform', 'none');
});

test('modo estático permite editar e baixar sem fingir gravação no Git', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');
  await expect(page.getByText('Modo de prévia:', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
  await page.getByLabel('Editar código Markdown').fill('# Versão estática');
  await expect(page.locator('.resume h1')).toHaveText('Versão estática');
  await expect(page.getByRole('tab', { name: 'Conteúdo', exact: true })).toHaveCount(0);
  const header = page.locator('.app-header');
  const chooser = page.waitForEvent('filechooser');
  await header.getByRole('button', { name: 'Import', exact: true }).click();
  await (await chooser).setFiles({
    name: 'importado.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Versão importada\n\nUm parágrafo de teste.'),
  });
  await expect(page.getByLabel('Editar código Markdown')).toHaveValue('# Versão importada\n\nUm parágrafo de teste.');
  await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click();
  await page.locator('.resume p').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    if (!selection) throw new Error('Seleção indisponível');
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await expect(page.getByRole('button', { name: 'Justificar texto', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Justificar texto', exact: true }).click();
  await expect(page.locator('.resume p')).toHaveCSS('text-align', 'justify');
  await expect(page.locator('.resume h1')).toHaveCSS('text-align', 'start');
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
  await page
    .getByLabel('Editar código Markdown')
    .fill('# Versão importada\n\nNovo parágrafo.\n\nUm parágrafo de teste.');
  await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Justificar texto', exact: true })).toBeDisabled();
  await expect(page.locator('.resume p').first()).toHaveCSS('text-align', 'left');
  await expect(page.locator('.resume p').last()).toHaveCSS('text-align', 'justify');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.resume p').last()).toHaveCSS('text-align', 'justify');
  await page.emulateMedia({ media: 'screen' });
  const download = page.waitForEvent('download');
  await header.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('base.md');
});

test('interface móvel cabe na viewport e permite edição', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('tab', { name: 'Vaga', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copiar prompt para IA' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
  await page.getByLabel('Editar código Markdown').fill('# Currículo no celular');
  await page.getByRole('button', { name: 'Fechar menu lateral' }).click();
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.getByRole('button', { name: 'Abrir menu lateral' }).click();
  await expect(page.getByLabel('Editar código Markdown')).toHaveValue('# Currículo no celular');
});

test('campos numéricos aceitam digitação, botões, arraste e limites', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
  const text = page.getByRole('spinbutton', { name: 'Tamanho do texto', exact: true });
  await text.fill('11');
  await text.press('Enter');
  await expect(page.locator('.resume')).toHaveCSS('--cv-font-size', '11pt');
  await page.getByRole('button', { name: 'Aumentar tamanho do texto' }).click();
  await expect(text).toHaveValue('11.5');
  await page.getByRole('button', { name: 'Diminuir tamanho do texto' }).click();
  await expect(text).toHaveValue('11');

  const bounds = await text.boundingBox();
  if (!bounds) throw new Error('Campo não encontrado');
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 16, y, { steps: 4 });
  await expect(text).toHaveValue('12');
  await expect(page.locator('.resume')).toHaveCSS('--cv-font-size', '12pt');
  await page.mouse.move(x - 16, y, { steps: 4 });
  await expect(text).toHaveValue('10');
  await page.mouse.move(x + 160, y, { steps: 4 });
  await expect(text).toHaveValue('14');
  await page.mouse.up();
  await expect(page.locator('body')).not.toHaveClass(/is-scrubbing/);
  await expect(page.getByRole('button', { name: 'Aumentar tamanho do texto' })).toBeDisabled();

  const line = page.getByRole('spinbutton', { name: 'Altura da linha' });
  await line.fill('1.5');
  await line.press('Enter');
  await page.getByRole('button', { name: 'Diminuir altura da linha' }).click();
  await expect(line).toHaveValue('1.45');
  await expect(page.locator('.resume')).toHaveCSS('--cv-line-height', '1.45');

  for (const [label, css, next] of [
    ['Tamanho do nome', '--cv-heading-size', '25pt'],
    ['Margens da página', '--cv-margin', '17mm'],
    ['Entre seções', '--cv-section-gap', '17px'],
    ['Entre parágrafos', '--cv-paragraph-gap', '7px'],
  ]) {
    await page.getByRole('button', { name: `Aumentar ${label.toLowerCase()}` }).click();
    await expect(page.locator('.resume')).toHaveCSS(css, next);
  }
  await text.fill('');
  await text.press('Enter');
  await expect(text).toHaveValue('14');
  await text.fill('100');
  await text.press('Enter');
  await expect(text).toHaveValue('14');
});

test('abas confirmam exclusão, aceitam atalhos e removem arquivos e rascunhos', async ({ page }) => {
  const name = `${id}-tabs`;
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
    await page.getByRole('button', { name: 'Nova Versão', exact: true }).click();
    await page.getByLabel('Nome da versão').fill(name);
    await page.getByRole('button', { name: 'Criar versão', exact: true }).click();
    const versionTab = page.getByRole('tab', { name, exact: true });
    await expect(versionTab).toHaveAttribute('aria-selected', 'true');
    expect(await read(`${name}.md`)).toContain('# Felipe Rangel Ribeiro');
    await versionTab.click({ button: 'middle' });
    await expect(page.getByRole('heading', { name: 'Fechar significa excluir' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await versionTab.click({ clickCount: 3 });
    await expect(page.getByRole('heading', { name: 'Fechar significa excluir' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
    await page.getByLabel('Editar código Markdown').fill('# Rascunho a excluir');
    await page.getByRole('button', { name: `Fechar e excluir ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Fechar e excluir', exact: true }).click();
    await expect(versionTab).toHaveCount(0);
    for (const ext of ['md', 'layout.json', 'meta.json']) {
      await expect(fs.access(`content/cv/${name}.${ext}`)).rejects.toThrow();
    }
    await page.reload();
    await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
    await expect(versionTab).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('cv-studio:drafts:v1'))).not.toContain(name);
  } finally {
    await Promise.all(
      ['md', 'layout.json', 'meta.json'].map((ext) => fs.rm(`content/cv/${name}.${ext}`, { force: true })),
    );
  }
});

test('fechar todas as abas em modo estático mostra estado vazio e permite recomeçar', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');
  await expect(page.getByText('Modo de prévia:', { exact: false })).toBeVisible();
  while (await page.locator('.version-tab').count()) {
    await page.locator('.version-tab-close').first().click();
    await expect(page.getByRole('dialog')).toContainText('Os arquivos do projeto não serão removidos');
    await page.getByRole('button', { name: 'Fechar e excluir', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Nenhuma versão aberta' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nenhuma versão aberta' })).toBeVisible();
  await page.locator('.new-version-tab').click();
  await page.getByLabel('Nome da versão').fill('Recomeço');
  await page.getByRole('button', { name: 'Criar versão', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Recomeço', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.resume h1')).toHaveText('Seu nome');
});

test('alterna PDF, Markdown renderizado e Edição mantendo conteúdo e impressão', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
  const pdf = page.getByRole('button', { name: 'Visualizar PDF', exact: true });
  const markdown = page.getByRole('button', { name: 'Visualizar Markdown', exact: true });
  const text = page.getByRole('button', { name: 'Visualizar Texto', exact: true });
  await expect(pdf).toHaveAttribute('aria-pressed', 'true');
  await text.click();
  await expect(text).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.paper-stage')).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Editar código Markdown', exact: true })).toHaveValue(
    /# Felipe Rangel Ribeiro/,
  );
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
  const source = '# Nome de teste\n\n## Experiência\n\n- **Node.js**\n\n<script>alert("xss")</script>';
  await page.getByLabel('Editar código Markdown').fill(source);
  await expect(page.getByRole('textbox', { name: 'Editar código Markdown', exact: true })).toHaveValue(source);
  await expect(page.locator('.markdown-preview script')).toHaveCount(0);
  await markdown.click();
  await expect(page.locator('.markdown-rendered h1')).toHaveText('Nome de teste');
  await expect(page.locator('.markdown-rendered h2')).toHaveText('Experiência');
  await expect(page.locator('.markdown-rendered li strong')).toHaveText('Node.js');
  await expect(page.locator('.markdown-rendered script')).toHaveCount(0);
  await expect(page.locator('.markdown-preview pre')).toHaveCount(0);
  await text.click();
  const pageWidth = (await page.locator('.source-editor').boundingBox())?.width;
  if (!pageWidth) throw new Error('Página de edição não encontrada');
  await page.getByRole('button', { name: 'Aumentar zoom', exact: true }).click();
  expect((await page.locator('.source-editor').boundingBox())?.width).toBeGreaterThan(pageWidth);
  await page.getByRole('button', { name: 'Restaurar zoom', exact: true }).click();
  expect((await page.locator('.source-editor').boundingBox())?.width).toBeCloseTo(pageWidth, 0);
  const zoomControls = page.getByRole('toolbar', { name: 'Zoom do currículo' });
  await page.evaluate(() => window.scrollTo(0, 0));
  const controlsBounds = await zoomControls.boundingBox();
  const viewsBounds = await page.locator('.markdown-preview').boundingBox();
  if (!controlsBounds || !viewsBounds) throw new Error('Controles de visualização não encontrados');
  expect(controlsBounds.y + controlsBounds.height).toBeLessThanOrEqual(viewsBounds.y);
  await markdown.click();
  for (const property of ['font-family', 'font-size', 'line-height', 'padding', 'color', 'background-color']) {
    const expected = await page
      .locator('.resume')
      .evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);
    await expect(page.locator('.markdown-rendered')).toHaveCSS(property, expected);
  }
  expect((await page.locator('.markdown-rendered').boundingBox())?.width).toBeCloseTo(pageWidth, 0);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(zoomControls).toBeInViewport();
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true';
    };
  });
  await page.getByRole('button', { name: /^Export$/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.markdown-preview')).toBeHidden();
  await expect(page.locator('.resume h1')).toBeVisible();
  await expect(page.locator('.resume h1')).toHaveText('Nome de teste');
  await page.emulateMedia({ media: 'screen' });
  await pdf.click();
  await expect(page.locator('.markdown-preview')).toHaveCount(0);
  await expect(page.locator('.resume h1')).toBeVisible();
  await expect(page.locator('.resume h1')).toHaveText('Nome de teste');
  await page.setViewportSize({ width: 390, height: 844 });
  await markdown.click();
  await expect(markdown).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('editores visual e de código sincronizam, preservam tabelas e salvam Markdown', async ({ page }) => {
  const name = `${id}-editing`;
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
    await page.getByRole('button', { name: 'Nova Versão', exact: true }).click();
    await page.getByLabel('Nome da versão').fill(name);
    await page.getByRole('button', { name: 'Criar versão', exact: true }).click();
    await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
    const code = page.getByRole('textbox', { name: 'Editar código Markdown', exact: true });
    const source =
      '# Currículo de teste\n\n## Experiência\n\n- **Node.js**\n\n[GitHub](https://github.com/Yokuny)\n\n| Stack | Nível |\n| --- | --- |\n| React | Avançado |';
    await code.fill(source);
    await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
    await expect(page.getByLabel('Editar código Markdown')).toHaveValue(source);
    await page.getByRole('button', { name: 'Visualizar Markdown', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Editar Markdown formatado', exact: true })).toBeEditable();
    await expect(page.locator('.markdown-rendered table')).toContainText('Avançado');
    // Merely opening the visual editor must not rewrite the source.
    await expect.poll(() => read(`${name}.md`)).toBe(source);
    await page.locator('.markdown-rendered h1').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' atualizado');
    await expect(page.locator('.markdown-rendered h1')).toHaveText('Currículo de teste atualizado');
    await page.locator('.markdown-rendered td').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' e TypeScript');
    await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
    await expect(code).toHaveValue(/React e TypeScript/);
    await expect(code).toHaveValue(/https:\/\/github.com\/Yokuny/);
    await expect(code).toHaveValue(/\*\*Node.js\*\*/);
    await code.fill(source.replace('Currículo de teste', 'Título editado no código'));
    await page.getByRole('button', { name: 'Visualizar Markdown', exact: true }).click();
    await expect(page.locator('.markdown-rendered h1')).toHaveText('Título editado no código');
    await page.getByRole('tab', { name: 'Currículo base', exact: true }).click();
    await expect(page.locator('.markdown-rendered h1')).toHaveText('Felipe Rangel Ribeiro');
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.locator('.markdown-rendered h1')).toHaveText('Título editado no código');
    await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click();
    await expect(page.locator('.resume h1')).toHaveText('Título editado no código');
    await expect.poll(() => read(`${name}.md`)).toContain('# Título editado no código');
  } finally {
    await Promise.all(
      ['md', 'layout.json', 'meta.json'].map((ext) => fs.rm(`content/cv/${name}.${ext}`, { force: true })),
    );
  }
});

for (const mode of ['local', 'estático'] as const) {
  test(`cores de elementos persistem e aparecem no Markdown e na impressão em modo ${mode}`, async ({ page }) => {
    const name = `${id}-colors-${mode === 'local' ? 'local' : 'static'}`;
    try {
      await page.goto(mode === 'local' ? '/' : 'http://127.0.0.1:4173');
      await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
      await page.getByRole('button', { name: 'Nova Versão', exact: true }).click();
      await page.getByLabel('Nome da versão').fill(name);
      await page.getByRole('button', { name: 'Criar versão', exact: true }).click();
      await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
      await page
        .getByLabel('Editar código Markdown')
        .fill(
          [
            '# Título',
            'Subtítulo',
            '## Seção',
            '### H3',
            '#### H4',
            '##### H5',
            '###### H6',
            'Parágrafo **negrito** *itálico* ~~riscado~~ [link](https://example.com) e `inline`.',
            '- Item',
            '- [x] Tarefa',
            '---',
            '> Citação',
            '```js\nconst a = 1\n```',
            '| Coluna | Valor |\n| --- | --- |\n| A | Um |\n| B | Dois |',
          ].join('\n\n'),
        );
      const checks: [string, string, string][] = [
        ...[1, 2, 3, 4, 5, 6].map((level): [string, string, string] => [`h${level}`, 'color', `h${level}`]),
        ['h1 + p', 'color', 'subtitle'],
        ['h2', 'border-bottom-color', 'heading-border'],
        ['p', 'color', 'paragraph'],
        ['strong', 'color', 'strong'],
        ['em', 'color', 'em'],
        ['a', 'color', 'link'],
        ['li', 'color', 'list'],
        ['hr', 'border-top-color', 'rule'],
        ['th', 'color', 'table-header-text'],
        ['th', 'background-color', 'table-header-background'],
        ['td', 'color', 'table-text'],
        ['td', 'background-color', 'table-background'],
        ['td', 'border-bottom-color', 'table-border'],
        ['tr:last-child td', 'background-color', 'table-stripe'],
        ['blockquote', 'color', 'quote-text'],
        ['blockquote', 'background-color', 'quote-background'],
        ['blockquote', 'border-left-color', 'quote-border'],
        ['p code', 'color', 'code-text'],
        ['p code', 'background-color', 'code-background'],
        ['pre code', 'color', 'code-block-text'],
        ['pre', 'background-color', 'code-block-background'],
      ];
      const colors: Record<string, string> = {};
      for (const [index, group] of elementColorGroups.entries()) {
        await page.locator('.element-colors summary').filter({ hasText: group.label }).click();
        for (const [offset, { key, label }] of group.colors.entries()) {
          const color = `#${(0x213040 + index * 0x201000 + offset * 0x010203).toString(16)}`;
          colors[key] = color;
          await page.getByLabel(`Cor de ${label.toLowerCase()}`, { exact: true }).fill(color);
        }
      }
      const rgb = (key: string) => {
        const color = colors[key];
        return `rgb(${[1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16)).join(', ')})`;
      };
      // Inline element colors inherit into both renderers; heading-adjacent paragraphs have their own token.
      checks[checks.findIndex(([selector]) => selector === 'p')] = ['h6 + p', 'color', 'paragraph'];
      await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click();
      for (const [selector, property, key] of checks)
        await expect(page.locator(`.resume ${selector}`).first()).toHaveCSS(property, rgb(key));
      await expect(page.locator('.resume del')).toHaveCSS('color', rgb('del'));
      await expect(page.locator('.resume input[type="checkbox"]')).toHaveCSS('accent-color', rgb('checkbox'));
      expect(
        await page
          .locator('.resume li')
          .first()
          .evaluate((el) => getComputedStyle(el, '::marker').color),
      ).toBe(rgb('marker'));
      await page.getByRole('button', { name: 'Visualizar Markdown', exact: true }).click();
      for (const [selector, property, key] of checks)
        await expect(page.locator(`.markdown-rendered ${selector}`).first()).toHaveCSS(property, rgb(key));
      if (mode === 'local') {
        await expect
          .poll(async () => JSON.parse((await read(`${name}.layout.json`)) || '{}').elementColors)
          .toEqual(colors);
      }
      await page.reload();
      await page.getByRole('tab', { name, exact: true }).click();
      await expect(page.locator('.resume h1')).toHaveCSS('color', rgb('h1'));
      await page.emulateMedia({ media: 'print' });
      for (const [selector, property, key] of checks)
        await expect(page.locator(`.resume ${selector}`).first()).toHaveCSS(property, rgb(key));
      await page.emulateMedia({ media: 'screen' });
      await page.getByRole('tab', { name: 'Currículo base', exact: true }).click();
      await expect(page.locator('.resume h1')).toHaveCSS('color', 'rgb(29, 29, 31)');
      await page.getByRole('tab', { name, exact: true }).click();
      await page
        .locator('.element-colors summary')
        .filter({ hasText: /^Títulos$/ })
        .click();
      await page.getByRole('button', { name: 'Restaurar cor de título h1', exact: true }).click();
      await page.getByLabel('Cor de destaque', { exact: true }).fill('#abcdef');
      await expect(page.locator('.resume h1')).toHaveCSS('color', 'rgb(171, 205, 239)');
      await expect(page.locator('.resume h2')).toHaveCSS('color', rgb('h2'));
      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    } finally {
      await Promise.all(
        ['md', 'layout.json', 'meta.json'].map((ext) => fs.rm(`content/cv/${name}.${ext}`, { force: true })),
      );
    }
  });
}

for (const mode of ['local', 'estático'] as const) {
  test(`fontes por uso preservam herança, gravação e impressão em modo ${mode}`, async ({ page }) => {
    const name = `${id}-fonts-${mode === 'local' ? 'local' : 'static'}`;
    const choices: Record<string, FontFamily> = {};
    const selectors: [string, string][] = [
      ...[1, 2, 3, 4, 5, 6].map((level): [string, string] => [`h${level}`, `h${level}`]),
      ['subtitle', 'h1 + p'],
      ['paragraph', 'h6 + p'],
      ['strong', 'strong'],
      ['em', 'em'],
      ['del', ':is(del, s)'],
      ['link', 'a'],
      ['list', 'li'],
      ['table-text', 'td'],
      ['table-header-text', 'th'],
      ['quote', 'blockquote p'],
      ['code', 'p code'],
      ['code-block', 'pre code'],
    ];
    const css = (font: FontFamily) =>
      font.includes(' ') ? fontFamilyCss(font) : fontFamilyCss(font).replaceAll('"', '');
    try {
      await page.goto(mode === 'local' ? '/' : 'http://127.0.0.1:4173');
      await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled();
      await page.getByRole('button', { name: 'Nova Versão', exact: true }).click();
      await page.getByLabel('Nome da versão').fill(name);
      await page.getByRole('button', { name: 'Criar versão', exact: true }).click();
      await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click();
      await page
        .getByLabel('Editar código Markdown')
        .fill(
          [
            '# Título',
            'Subtítulo',
            '## H2',
            '### H3',
            '#### H4',
            '##### H5',
            '###### H6',
            'Parágrafo **negrito** *itálico* ~~riscado~~ [link](https://example.com) e `inline`.',
            '- Primeiro parágrafo.\n\n  Segundo parágrafo.',
            '> Citação',
            '```js\nconst x = 1\n```',
            '| Coluna | Valor |\n| --- | --- |\n| A | Um |',
          ].join('\n\n'),
        );
      await page.getByLabel('Família da fonte', { exact: true }).selectOption('Georgia');
      await expect(page.locator('.resume h1')).toHaveCSS('font-family', 'Georgia, serif');
      await expect(page.locator('.resume code').last()).not.toHaveCSS('font-family', 'Georgia, serif');
      for (const [index, group] of elementFontGroups.entries()) {
        await page.locator('.element-fonts summary').filter({ hasText: group.label }).click();
        for (const [offset, { key, label }] of group.elements.entries()) {
          const font = fonts[(index + offset + 2) % fonts.length];
          choices[key] = font;
          await page.getByLabel(`Família da fonte de ${label.toLowerCase()}`, { exact: true }).selectOption(font);
        }
      }
      await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click();
      for (const [key, selector] of selectors)
        await expect(page.locator(`.resume ${selector}`).first()).toHaveCSS('font-family', css(choices[key]));
      await expect(page.locator('.resume li p').last()).toHaveCSS('font-family', css(choices.list));
      expect(
        await page
          .locator('.resume li')
          .first()
          .evaluate((el) => getComputedStyle(el, '::marker').fontFamily),
      ).toBe(css(choices.marker));
      await page.getByRole('button', { name: 'Visualizar Markdown', exact: true }).click();
      for (const [key, selector] of selectors)
        await expect(page.locator(`.markdown-rendered ${selector}`).first()).toHaveCSS(
          'font-family',
          css(choices[key]),
        );
      await expect(page.locator('.markdown-rendered td p').first()).toHaveCSS(
        'font-family',
        css(choices['table-text']),
      );
      await expect(page.locator('.markdown-rendered th p').first()).toHaveCSS(
        'font-family',
        css(choices['table-header-text']),
      );
      if (mode === 'local') {
        await expect
          .poll(async () => JSON.parse((await read(`${name}.layout.json`)) || '{}').elementFonts)
          .toEqual(choices);
      }
      await page.reload();
      await page.getByRole('tab', { name, exact: true }).click();
      await page.emulateMedia({ media: 'print' });
      for (const [key, selector] of selectors)
        await expect(page.locator(`.resume ${selector}`).first()).toHaveCSS('font-family', css(choices[key]));
      await page.emulateMedia({ media: 'screen' });
      await page.getByRole('tab', { name: 'Currículo base', exact: true }).click();
      await expect(page.locator('.resume h1')).toHaveCSS('font-family', 'Arial, serif');
      await page.getByRole('tab', { name, exact: true }).click();
      await page
        .locator('.element-fonts summary')
        .filter({ hasText: /^Títulos$/ })
        .click();
      await page.getByLabel('Família da fonte de título h1', { exact: true }).selectOption('');
      await page.getByLabel('Família da fonte', { exact: true }).selectOption('Helvetica');
      await expect(page.locator('.resume h1')).toHaveCSS('font-family', 'Helvetica, serif');
      await expect(page.locator('.resume h2')).toHaveCSS('font-family', css(choices.h2));
      await page.getByRole('button', { name: 'Restaurar design padrão', exact: true }).click();
      await expect(page.locator('.resume h2')).toHaveCSS('font-family', 'Arial, serif');
      await expect(page.locator('.resume code').last()).not.toHaveCSS('font-family', 'Arial, serif');
      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    } finally {
      await Promise.all(
        ['md', 'layout.json', 'meta.json'].map((ext) => fs.rm(`content/cv/${name}.${ext}`, { force: true })),
      );
    }
  });
}

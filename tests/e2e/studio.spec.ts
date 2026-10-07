import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const id = `e2e-${Date.now()}`
test.afterAll(async () => {
  await Promise.all(
    ['md', 'layout.json', 'meta.json'].map((ext) =>
      fs.rm(path.join('content/cv', `${id}.${ext}`), { force: true }),
    ),
  )
})

test('cria versão, edita Markdown e tokens, grava arquivos e detecta conflito', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled()
  await expect(page.locator('.resume h1')).toHaveText('Felipe Rangel Ribeiro')
  await page.getByRole('button', { name: 'Nova Versão', exact: true }).click()
  await page.getByLabel('Nome da versão').fill(id)
  await page.getByRole('button', { name: 'Criar versão', exact: true }).click()
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
  await page
    .getByLabel('Editar código Markdown')
    .fill(
      '# Felipe Rangel Ribeiro\n\n## Backend\n\n- Node.js e AWS\n\n[GitHub](https://github.com/Yokuny)\n\n<script>alert("xss")</script>',
    )
  await expect(page.locator('.resume h2')).toHaveText('Backend')
  await expect(page.locator('.resume script')).toHaveCount(0)
  await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click()
  await page.getByLabel('Família da fonte').selectOption('Georgia')
  await page.getByLabel('Cor de destaque').fill('#334455')
  await expect(page.getByRole('button', { name: 'Justificar texto', exact: true })).toBeDisabled()
  await page.locator('.resume li').evaluate((element) => {
    const range = document.createRange()
    const text = element.firstChild
    const selection = window.getSelection()
    if (!text || !selection) throw new Error('Texto não selecionável')
    range.setStart(text, 0)
    range.setEnd(text, 4)
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await expect(page.getByRole('button', { name: 'Justificar texto', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Justificar texto', exact: true }).click()
  await expect(page.locator('.resume li')).toHaveCSS('text-align', 'justify')
  await expect(page.locator('.resume h1')).toHaveCSS('text-align', 'start')
  await expect(page.locator('.resume')).toHaveCSS('font-family', 'Georgia, serif')
  await page.getByRole('spinbutton', { name: 'Tamanho do texto' }).focus()
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('.resume')).toHaveCSS('font-size', '14px')
  const previewWidth = await page.locator('.workspace').evaluate((el) => el.clientWidth)
  await page.getByRole('button', { name: 'Fechar menu lateral' }).click()
  await expect(page.locator('.sidebar')).toBeHidden()
  expect(await page.locator('.workspace').evaluate((el) => el.clientWidth)).toBeGreaterThan(
    previewWidth,
  )
  await page.getByRole('button', { name: 'Abrir menu lateral' }).click()
  await expect(page.getByLabel('Família da fonte')).toHaveValue('Georgia')
  await expect(page.locator('.resume h2')).toHaveText('Backend')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('salva em content/cv')
  expect(await fs.readFile(`content/cv/${id}.md`, 'utf8')).toContain('Node.js e AWS')
  expect(JSON.parse(await fs.readFile(`content/cv/${id}.layout.json`, 'utf8')).accentColor).toBe(
    '#334455',
  )
  expect(
    JSON.parse(await fs.readFile(`content/cv/${id}.layout.json`, 'utf8')).blockAlignments,
  ).toEqual([expect.objectContaining({ align: 'justify' })])
  await page.reload()
  await page.getByRole('tab', { name: id, exact: true }).click()
  await expect(page.locator('.resume li')).toHaveCSS('text-align', 'justify')
  const all = await (await request.get('/api/resumes')).json()
  const persisted = all.find((v: { id: string }) => v.id === id)
  const { revision, ...resume } = persisted
  expect(resume).not.toHaveProperty('job')
  const metaPath = `content/cv/${id}.meta.json`
  expect(JSON.parse(await fs.readFile(metaPath, 'utf8'))).not.toHaveProperty('job')
  // A pending draft from the previous schema still has its old revision.
  await fs.writeFile(metaPath, JSON.stringify({ name: resume.name, job: 'Contexto antigo' }))
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
    .digest('hex')
  const migrated = await request.post('/api/resumes', {
    data: { resume, expectedRevision: legacyRevision },
  })
  expect(migrated.status()).toBe(200)
  expect(JSON.parse(await fs.readFile(metaPath, 'utf8'))).toEqual({ name: resume.name })
  const externallyEdited = await request.post('/api/resumes', {
    data: { resume: { ...resume, markdown: '# Alterado no disco' }, expectedRevision: revision },
  })
  expect(externallyEdited.status()).toBe(200)
  const staleSave = await request.post('/api/resumes', {
    data: { resume, expectedRevision: revision },
  })
  expect(staleSave.status()).toBe(409)
  const staleDelete = await request.delete('/api/resumes', {
    data: { id, expectedRevision: revision },
  })
  expect(staleDelete.status()).toBe(409)
  const invalidDelete = await request.delete('/api/resumes', {
    data: { id: '../../escape', expectedRevision: null },
  })
  expect(invalidDelete.status()).toBe(400)
  const foreignDelete = await request.delete('/api/resumes', {
    headers: { Origin: 'https://example.com' },
    data: { id, expectedRevision: revision },
  })
  expect(foreignDelete.status()).toBe(403)
  const invalid = await request.post('/api/resumes', {
    data: { resume: { ...resume, id: '../../escape' }, expectedRevision: null },
  })
  expect(invalid.status()).toBe(400)
  const crossOrigin = await request.post('/api/resumes', {
    headers: { Origin: 'https://example.com' },
    data: { resume, expectedRevision: revision },
  })
  expect(crossOrigin.status()).toBe(403)
  expect(errors).toEqual([])
})

test('restaura rascunho e aplica impressão A4 sem a interface', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled()
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
  await page
    .getByLabel('Editar código Markdown')
    .fill('# Rascunho persistente\n\nTexto para testar.\n\n[Link](https://github.com/Yokuny)')
  await page.reload()
  await expect(page.locator('.resume h1')).toHaveText('Rascunho persistente')
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true'
    }
  })
  await page.getByRole('button', { name: /^Export$/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.app-header')).toBeHidden()
  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(page.locator('.resume')).toHaveCSS('transform', 'none')
})

test('modo estático permite editar e baixar sem fingir gravação no Git', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173')
  await expect(page.getByText('Modo de prévia:', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
  await page.getByLabel('Editar código Markdown').fill('# Versão estática')
  await expect(page.locator('.resume h1')).toHaveText('Versão estática')
  await expect(page.getByRole('tab', { name: 'Conteúdo', exact: true })).toHaveCount(0)
  const header = page.locator('.app-header')
  const chooser = page.waitForEvent('filechooser')
  await header.getByRole('button', { name: 'Import', exact: true }).click()
  await (await chooser).setFiles({
    name: 'importado.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Versão importada\n\nUm parágrafo de teste.'),
  })
  await expect(page.getByLabel('Editar código Markdown')).toHaveValue(
    '# Versão importada\n\nUm parágrafo de teste.',
  )
  await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click()
  await page.locator('.resume p').evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    if (!selection) throw new Error('Seleção indisponível')
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await expect(page.getByRole('button', { name: 'Justificar texto', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Justificar texto', exact: true }).click()
  await expect(page.locator('.resume p')).toHaveCSS('text-align', 'justify')
  await expect(page.locator('.resume h1')).toHaveCSS('text-align', 'start')
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
  await page
    .getByLabel('Editar código Markdown')
    .fill('# Versão importada\n\nNovo parágrafo.\n\nUm parágrafo de teste.')
  await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Justificar texto', exact: true })).toBeDisabled()
  await expect(page.locator('.resume p').first()).toHaveCSS('text-align', 'left')
  await expect(page.locator('.resume p').last()).toHaveCSS('text-align', 'justify')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.resume p').last()).toHaveCSS('text-align', 'justify')
  await page.emulateMedia({ media: 'screen' })
  const download = page.waitForEvent('download')
  await header.getByRole('button', { name: 'Download', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('base.md')
})

test('interface móvel cabe na viewport e permite edição', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByRole('tab', { name: 'Vaga', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copiar prompt para IA' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
  await page.getByLabel('Editar código Markdown').fill('# Currículo no celular')
  await page.getByRole('button', { name: 'Fechar menu lateral' }).click()
  await expect(page.locator('.sidebar')).toBeHidden()
  await page.getByRole('button', { name: 'Abrir menu lateral' }).click()
  await expect(page.getByLabel('Editar código Markdown')).toHaveValue('# Currículo no celular')
})

test('campos numéricos aceitam digitação, botões, arraste e limites', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled()
  const text = page.getByRole('spinbutton', { name: 'Tamanho do texto', exact: true })
  await text.fill('11')
  await text.press('Enter')
  await expect(page.locator('.resume')).toHaveCSS('--cv-font-size', '11pt')
  await page.getByRole('button', { name: 'Aumentar tamanho do texto' }).click()
  await expect(text).toHaveValue('11.5')
  await page.getByRole('button', { name: 'Diminuir tamanho do texto' }).click()
  await expect(text).toHaveValue('11')

  const bounds = await text.boundingBox()
  if (!bounds) throw new Error('Campo não encontrado')
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 16, y, { steps: 4 })
  await expect(text).toHaveValue('12')
  await expect(page.locator('.resume')).toHaveCSS('--cv-font-size', '12pt')
  await page.mouse.move(x - 16, y, { steps: 4 })
  await expect(text).toHaveValue('10')
  await page.mouse.move(x + 160, y, { steps: 4 })
  await expect(text).toHaveValue('14')
  await page.mouse.up()
  await expect(page.locator('body')).not.toHaveClass(/is-scrubbing/)
  await expect(page.getByRole('button', { name: 'Aumentar tamanho do texto' })).toBeDisabled()

  const line = page.getByRole('spinbutton', { name: 'Altura da linha' })
  await line.fill('1.5')
  await line.press('Enter')
  await page.getByRole('button', { name: 'Diminuir altura da linha' }).click()
  await expect(line).toHaveValue('1.45')
  await expect(page.locator('.resume')).toHaveCSS('--cv-line-height', '1.45')

  for (const [label, css, next] of [
    ['Tamanho do nome', '--cv-heading-size', '25pt'],
    ['Margens da página', '--cv-margin', '17mm'],
    ['Entre seções', '--cv-section-gap', '17px'],
    ['Entre parágrafos', '--cv-paragraph-gap', '7px'],
  ]) {
    await page.getByRole('button', { name: `Aumentar ${label.toLowerCase()}` }).click()
    await expect(page.locator('.resume')).toHaveCSS(css, next)
  }
  await text.fill('')
  await text.press('Enter')
  await expect(text).toHaveValue('14')
  await text.fill('100')
  await text.press('Enter')
  await expect(text).toHaveValue('14')
})

test('abas confirmam exclusão, aceitam atalhos e removem arquivos e rascunhos', async ({
  page,
}) => {
  const name = `${id}-tabs`
  try {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled()
    await page.getByRole('button', { name: 'Nova Versão', exact: true }).click()
    await page.getByLabel('Nome da versão').fill(name)
    await page.getByRole('button', { name: 'Criar versão', exact: true }).click()
    const versionTab = page.getByRole('tab', { name, exact: true })
    await expect(versionTab).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toContainText('salva em content/cv')
    await versionTab.click({ button: 'middle' })
    await expect(page.getByRole('heading', { name: 'Fechar significa excluir' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await versionTab.click({ clickCount: 3 })
    await expect(page.getByRole('heading', { name: 'Fechar significa excluir' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
    await page.getByLabel('Editar código Markdown').fill('# Rascunho a excluir')
    await page.getByRole('button', { name: `Fechar e excluir ${name}`, exact: true }).click()
    await page.getByRole('button', { name: 'Fechar e excluir', exact: true }).click()
    await expect(versionTab).toHaveCount(0)
    for (const ext of ['md', 'layout.json', 'meta.json']) {
      await expect(fs.access(`content/cv/${name}.${ext}`)).rejects.toThrow()
    }
    await page.reload()
    await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled()
    await expect(versionTab).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('cv-studio:drafts:v1'))).not.toContain(
      name,
    )
  } finally {
    await Promise.all(
      ['md', 'layout.json', 'meta.json'].map((ext) =>
        fs.rm(`content/cv/${name}.${ext}`, { force: true }),
      ),
    )
  }
})

test('fechar todas as abas em modo estático mostra estado vazio e permite recomeçar', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4173')
  await expect(page.getByText('Modo de prévia:', { exact: false })).toBeVisible()
  while (await page.locator('.version-tab').count()) {
    await page.locator('.version-tab-close').first().click()
    await expect(page.getByRole('dialog')).toContainText(
      'Os arquivos do projeto não serão removidos',
    )
    await page.getByRole('button', { name: 'Fechar e excluir', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'Nenhuma versão aberta' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Nenhuma versão aberta' })).toBeVisible()
  await page.locator('.new-version-tab').click()
  await page.getByLabel('Nome da versão').fill('Recomeço')
  await page.getByRole('button', { name: 'Criar versão', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Recomeço', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.resume h1')).toHaveText('Seu nome')
})

test('alterna PDF, Markdown renderizado e Edição mantendo conteúdo e impressão', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled()
  const pdf = page.getByRole('button', { name: 'Visualizar PDF', exact: true })
  const markdown = page.getByRole('button', { name: 'Visualizar Markdown', exact: true })
  const text = page.getByRole('button', { name: 'Visualizar Texto', exact: true })
  await expect(pdf).toHaveAttribute('aria-pressed', 'true')
  await text.click()
  await expect(text).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.paper-stage')).toBeHidden()
  await expect(
    page.getByRole('textbox', { name: 'Editar código Markdown', exact: true }),
  ).toHaveValue(/# Felipe Rangel Ribeiro/)
  await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
  const source =
    '# Nome de teste\n\n## Experiência\n\n- **Node.js**\n\n<script>alert("xss")</script>'
  await page.getByLabel('Editar código Markdown').fill(source)
  await expect(
    page.getByRole('textbox', { name: 'Editar código Markdown', exact: true }),
  ).toHaveValue(source)
  await expect(page.locator('.markdown-preview script')).toHaveCount(0)
  await markdown.click()
  await expect(page.locator('.markdown-rendered h1')).toHaveText('Nome de teste')
  await expect(page.locator('.markdown-rendered h2')).toHaveText('Experiência')
  await expect(page.locator('.markdown-rendered li strong')).toHaveText('Node.js')
  await expect(page.locator('.markdown-rendered script')).toHaveCount(0)
  await expect(page.locator('.markdown-preview pre')).toHaveCount(0)
  await text.click()
  const pageWidth = (await page.locator('.source-editor').boundingBox())?.width
  if (!pageWidth) throw new Error('Página de edição não encontrada')
  await page.getByRole('button', { name: 'Aumentar zoom', exact: true }).click()
  expect((await page.locator('.source-editor').boundingBox())?.width).toBeGreaterThan(pageWidth)
  await page.getByRole('button', { name: 'Restaurar zoom', exact: true }).click()
  expect((await page.locator('.source-editor').boundingBox())?.width).toBeCloseTo(pageWidth, 0)
  const zoomControls = page.getByRole('toolbar', { name: 'Zoom do currículo' })
  await page.evaluate(() => window.scrollTo(0, 0))
  const controlsBounds = await zoomControls.boundingBox()
  const viewsBounds = await page.locator('.markdown-preview').boundingBox()
  if (!controlsBounds || !viewsBounds) throw new Error('Controles de visualização não encontrados')
  expect(controlsBounds.y + controlsBounds.height).toBeLessThanOrEqual(viewsBounds.y)
  await markdown.click()
  for (const property of [
    'font-family',
    'font-size',
    'line-height',
    'padding',
    'color',
    'background-color',
  ]) {
    const expected = await page
      .locator('.resume')
      .evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property)
    await expect(page.locator('.markdown-rendered')).toHaveCSS(property, expected)
  }
  expect((await page.locator('.markdown-rendered').boundingBox())?.width).toBeCloseTo(pageWidth, 0)
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect(zoomControls).toBeInViewport()
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true'
    }
  })
  await page.getByRole('button', { name: /^Export$/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.markdown-preview')).toBeHidden()
  await expect(page.locator('.resume h1')).toBeVisible()
  await expect(page.locator('.resume h1')).toHaveText('Nome de teste')
  await page.emulateMedia({ media: 'screen' })
  await pdf.click()
  await expect(page.locator('.markdown-preview')).toHaveCount(0)
  await expect(page.locator('.resume h1')).toBeVisible()
  await expect(page.locator('.resume h1')).toHaveText('Nome de teste')
  await page.setViewportSize({ width: 390, height: 844 })
  await markdown.click()
  await expect(markdown).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('editores visual e de código sincronizam, preservam tabelas e salvam Markdown', async ({
  page,
}) => {
  const name = `${id}-editing`
  try {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^Export$/ })).toBeEnabled()
    await page.getByRole('button', { name: 'Nova Versão', exact: true }).click()
    await page.getByLabel('Nome da versão').fill(name)
    await page.getByRole('button', { name: 'Criar versão', exact: true }).click()
    await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
    const code = page.getByRole('textbox', { name: 'Editar código Markdown', exact: true })
    const source =
      '# Currículo de teste\n\n## Experiência\n\n- **Node.js**\n\n[GitHub](https://github.com/Yokuny)\n\n| Stack | Nível |\n| --- | --- |\n| React | Avançado |'
    await code.fill(source)
    await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
    await expect(page.getByLabel('Editar código Markdown')).toHaveValue(source)
    await page.getByRole('button', { name: 'Visualizar Markdown', exact: true }).click()
    await expect(
      page.getByRole('textbox', { name: 'Editar Markdown formatado', exact: true }),
    ).toBeEditable()
    await expect(page.locator('.markdown-rendered table')).toContainText('Avançado')
    // Merely opening the visual editor must not rewrite the source.
    expect(
      await page.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem('cv-studio:drafts:v1') ?? '[]').find(
            (v: { id: string }) => v.id === id,
          )?.markdown,
        name,
      ),
    ).toBe(source)
    await page.locator('.markdown-rendered h1').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' atualizado')
    await expect(page.locator('.markdown-rendered h1')).toHaveText('Currículo de teste atualizado')
    await page.locator('.markdown-rendered td').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' e TypeScript')
    await page.getByRole('button', { name: 'Visualizar Texto', exact: true }).click()
    await expect(code).toHaveValue(/React e TypeScript/)
    await expect(code).toHaveValue(/https:\/\/github.com\/Yokuny/)
    await expect(code).toHaveValue(/\*\*Node.js\*\*/)
    await code.fill(source.replace('Currículo de teste', 'Título editado no código'))
    await page.getByRole('button', { name: 'Visualizar Markdown', exact: true }).click()
    await expect(page.locator('.markdown-rendered h1')).toHaveText('Título editado no código')
    await page.getByRole('tab', { name: 'Currículo base', exact: true }).click()
    await expect(page.locator('.markdown-rendered h1')).toHaveText('Felipe Rangel Ribeiro')
    await page.getByRole('tab', { name, exact: true }).click()
    await expect(page.locator('.markdown-rendered h1')).toHaveText('Título editado no código')
    await page.getByRole('button', { name: 'Visualizar PDF', exact: true }).click()
    await expect(page.locator('.resume h1')).toHaveText('Título editado no código')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toContainText('salva em content/cv')
    expect(await fs.readFile(`content/cv/${name}.md`, 'utf8')).toContain(
      '# Título editado no código',
    )
  } finally {
    await Promise.all(
      ['md', 'layout.json', 'meta.json'].map((ext) =>
        fs.rm(`content/cv/${name}.${ext}`, { force: true }),
      ),
    )
  }
})

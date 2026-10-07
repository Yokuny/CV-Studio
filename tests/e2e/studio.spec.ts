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
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled()
  await expect(page.locator('.resume h1')).toHaveText('Felipe Rangel Ribeiro')
  await page.getByRole('button', { name: 'Nova Versão', exact: true }).click()
  await page.getByLabel('Nome da versão').fill(id)
  await page.getByRole('button', { name: 'Criar versão', exact: true }).click()
  await page.getByRole('tab', { name: 'Conteúdo' }).click()
  await page
    .getByLabel('Conteúdo do currículo')
    .fill(
      '# Felipe Rangel Ribeiro\n\n## Backend\n\n- Node.js e AWS\n\n[GitHub](https://github.com/Yokuny)\n\n<script>alert("xss")</script>',
    )
  await expect(page.locator('.resume h2')).toHaveText('Backend')
  await expect(page.locator('.resume script')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Design' }).click()
  await page.getByLabel('Família da fonte').selectOption('Georgia')
  await page.getByLabel('Cor de destaque').fill('#334455')
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
  await page.getByRole('button', { name: 'Salvar versão' }).click()
  await expect(page.getByRole('status')).toContainText('salva em content/cv')
  expect(await fs.readFile(`content/cv/${id}.md`, 'utf8')).toContain('Node.js e AWS')
  expect(JSON.parse(await fs.readFile(`content/cv/${id}.layout.json`, 'utf8')).accentColor).toBe(
    '#334455',
  )
  const all = await (await request.get('/api/resumes')).json()
  const persisted = all.find((v: { id: string }) => v.id === id)
  const { revision, ...resume } = persisted
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
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled()
  await page.getByRole('tab', { name: 'Conteúdo' }).click()
  await page
    .getByLabel('Conteúdo do currículo')
    .fill('# Rascunho persistente\n\nTexto para testar.\n\n[Link](https://github.com/Yokuny)')
  await page.reload()
  await expect(page.locator('.resume h1')).toHaveText('Rascunho persistente')
  await expect(page.getByRole('button', { name: 'Salvar versão' })).toBeEnabled()
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true'
    }
  })
  await page.getByRole('button', { name: 'Exportar PDF' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.app-header')).toBeHidden()
  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(page.locator('.resume')).toHaveCSS('transform', 'none')
})

test('modo estático permite editar e baixar sem fingir gravação no Git', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173')
  await expect(page.getByText('Modo de prévia:', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar versão' })).toBeDisabled()
  await page.getByRole('tab', { name: 'Conteúdo' }).click()
  await page.getByLabel('Conteúdo do currículo').fill('# Versão estática')
  await expect(page.locator('.resume h1')).toHaveText('Versão estática')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar arquivos', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('base.md')
})

test('interface móvel cabe na viewport e permite edição', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('tab', { name: 'Vaga', exact: true }).click()
  await page.getByLabel('O que a vaga pede?').fill('Node.js e AWS')
  await expect(page.getByRole('button', { name: 'Copiar prompt para IA' })).toBeEnabled()
  await page.getByRole('button', { name: 'Fechar menu lateral' }).click()
  await expect(page.locator('.sidebar')).toBeHidden()
  await page.getByRole('button', { name: 'Abrir menu lateral' }).click()
  await expect(page.getByLabel('O que a vaga pede?')).toHaveValue('Node.js e AWS')
})

test('campos numéricos aceitam digitação, botões, arraste e limites', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled()
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
    await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled()
    await page.getByRole('button', { name: 'Nova Versão', exact: true }).click()
    await page.getByLabel('Nome da versão').fill(name)
    await page.getByRole('button', { name: 'Criar versão', exact: true }).click()
    const versionTab = page.getByRole('tab', { name, exact: true })
    await expect(versionTab).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'Salvar versão' }).click()
    await expect(page.getByRole('status')).toContainText('salva em content/cv')
    await versionTab.click({ button: 'middle' })
    await expect(page.getByRole('heading', { name: 'Fechar significa excluir' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await versionTab.click({ clickCount: 3 })
    await expect(page.getByRole('heading', { name: 'Fechar significa excluir' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await page.getByRole('tab', { name: 'Conteúdo', exact: true }).click()
    await page.getByLabel('Conteúdo do currículo').fill('# Rascunho a excluir')
    await page.getByRole('button', { name: `Fechar e excluir ${name}`, exact: true }).click()
    await page.getByRole('button', { name: 'Fechar e excluir', exact: true }).click()
    await expect(versionTab).toHaveCount(0)
    for (const ext of ['md', 'layout.json', 'meta.json']) {
      await expect(fs.access(`content/cv/${name}.${ext}`)).rejects.toThrow()
    }
    await page.reload()
    await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled()
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
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeDisabled()
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

import { type Browser, chromium } from 'playwright';

let browser: Promise<Browser> | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;

/**
 * Prints a resume version to PDF the same way the browser does: the studio page renders it from
 * content/cv and Chromium applies its @page A4 rules, keeping text selectable and links clickable.
 */
export async function renderPdf(webOrigin: string, id: string): Promise<Buffer> {
  clearTimeout(idle);
  browser ??= chromium.launch().catch((e) => {
    browser = undefined;
    throw new Error(
      `Não foi possível abrir o Chromium para gerar o PDF. Rode "pnpm setup:pdf" uma vez. (${(e as Error).message.split('\n')[0]})`,
    );
  });
  const context = await (await browser).newContext();
  try {
    const page = await context.newPage();
    try {
      await page.goto(`${webOrigin}/?print=${encodeURIComponent(id)}`, { waitUntil: 'load', timeout: 20000 });
    } catch {
      throw new Error(`A interface não respondeu em ${webOrigin}. Deixe "pnpm run dev" aberto para gerar o PDF.`);
    }
    const state = await page
      .waitForFunction(() => document.documentElement.dataset.printReady, undefined, { timeout: 20000 })
      .then((handle) => handle.jsonValue());
    if (state !== 'ready') throw new Error(`A versão "${id}" não foi encontrada em content/cv.`);
    await page.emulateMedia({ media: 'print' });
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await context.close();
    // Keep Chromium warm for a burst of sends, then release it.
    idle = setTimeout(() => void closePdfBrowser(), 60000);
  }
}

export async function closePdfBrowser() {
  clearTimeout(idle);
  const current = browser;
  browser = undefined;
  await (await current?.catch(() => undefined))?.close();
}

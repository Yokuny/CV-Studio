import type { Resume } from '@cv-studio/core/model';
import { type Browser, chromium } from 'playwright';
import { resumeHtml } from './resume-html';

let browser: Promise<Browser> | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;

/** A4 at the 96 dpi of CSS pixels. */
const mm = 96 / 25.4;
const a4 = { width: 210, height: 297 };

export interface PrintedPdf {
  pdf: Buffer;
  pages: number;
  /** Layout problems found before printing: content cut at the margin or blocks taller than a page. */
  issues: string[];
}

/**
 * Runs in the page: elements past the right margin lose text, and list items or table rows taller
 * than the printable area cannot stay whole. Kept as source text because the CLI (tsx) would
 * otherwise inject helpers that do not exist in the page.
 */
const layoutIssues = `(width, height) => {
  const found = [];
  for (const el of document.querySelectorAll('.resume *')) {
    const box = el.getBoundingClientRect();
    const label = '<' + el.tagName.toLowerCase() + '> "' + (el.textContent || '').trim().slice(0, 50) + '"';
    if (box.right > width + 0.5) found.push('Passa da margem direita: ' + label);
    if ((el.tagName === 'LI' || el.tagName === 'TR') && box.height > height)
      found.push('Mais alto que uma página, será partido: ' + label);
  }
  return found;
}`;

/** Pages of a PDF written by Chromium, which keeps each page object uncompressed. */
export function countPages(pdf: Buffer) {
  return pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
}

/**
 * Prints a resume version to PDF the way "Exportar PDF" does, without the studio open: Chromium
 * renders the same Markdown component and resume.css with the tokens of <slug>.layout.json and
 * applies the A4 @page rules, keeping text selectable and links clickable.
 */
export async function renderPdf(resume: Resume): Promise<PrintedPdf> {
  clearTimeout(idle);
  browser ??= chromium.launch().catch((e) => {
    browser = undefined;
    throw new Error(
      `Não foi possível abrir o Chromium para gerar o PDF. Rode "pnpm setup:pdf" uma vez. (${(e as Error).message.split('\n')[0]})`,
    );
  });
  const width = Math.floor((a4.width - 2 * resume.layout.margin) * mm);
  const height = Math.floor((a4.height - 2 * resume.layout.margin) * mm);
  // The viewport is the printable area, so what is measured below is what the page receives.
  const context = await (await browser).newContext({ viewport: { width, height } });
  try {
    const page = await context.newPage();
    await page.emulateMedia({ media: 'print' });
    await page.setContent(resumeHtml(resume), { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    const issues = (await page.evaluate(`(${layoutIssues})(${width}, ${height})`)) as string[];
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return { pdf, pages: countPages(pdf), issues };
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

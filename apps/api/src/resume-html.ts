import { readFileSync } from 'node:fs';
import path from 'node:path';
import { layoutCssDeclarations, type Resume } from '@cv-studio/core/model';
import { ResumeMarkdown } from '@cv-studio/core/resume';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { repoRoot } from './paths';

const resumeCss = path.join(repoRoot, 'packages/core/src/resume.css');

/**
 * The parts of Tailwind's preflight that shape the resume in the studio. The UI gets them from
 * Tailwind; this standalone page has no Tailwind, so it repeats them to print the same layout.
 */
const reset = `*, ::before, ::after { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid; }
html { line-height: 1.5; -webkit-text-size-adjust: 100%; tab-size: 4; }
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
a { color: inherit; text-decoration: inherit; }
b, strong { font-weight: bolder; }
code, kbd, samp, pre { font-size: 1em; }
small { font-size: 80%; }
table { text-indent: 0; border-color: inherit; border-collapse: collapse; }
ol, ul, menu { list-style: none; }
img, svg, video { display: block; vertical-align: middle; }
img, video { max-width: 100%; height: auto; }
hr { height: 0; color: inherit; border-top-width: 1px; }`;

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/**
 * A print-ready page of one resume version: the same Markdown component and resume.css as the
 * studio, with the tokens of <slug>.layout.json and the A4 @page of "Exportar PDF".
 */
export function resumeHtml(resume: Resume) {
  const { layout, markdown, name } = resume;
  const body = renderToStaticMarkup(createElement(ResumeMarkdown, { markdown, layout }));
  // The tokens go on :root as well, so the page background follows the paper color.
  const tokens = layoutCssDeclarations(layout, '  ');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(name)}</title>
<style>
${reset}
:root {
${tokens}
}
html, body { background: var(--cv-paper); }
@page { size: A4; margin: ${layout.margin}mm; }
${readFileSync(resumeCss, 'utf8')}
</style>
</head>
<body>
<article class="resume" data-version="${escapeHtml(resume.id)}">${body}</article>
</body>
</html>
`;
}

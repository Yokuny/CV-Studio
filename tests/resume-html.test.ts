import { alignBlocks, defaultLayout } from '@cv-studio/core/model';
import { describe, expect, it } from 'vitest';
import { countPages } from '../apps/api/src/pdf';
import { resumeHtml } from '../apps/api/src/resume-html';

describe('PDF do currículo', () => {
  it('aplica os tokens do layout, o alinhamento por bloco e a margem A4', () => {
    const markdown = '# Felipe\n\nCargo\n\n## Resumo\n\nTexto <b>sem HTML</b>\n';
    const layout = alignBlocks(
      { ...defaultLayout, fontFamily: 'Georgia', accentColor: '#123456', margin: 20, elementColors: { h2: '#abcdef' } },
      markdown,
      [{ start: 10, end: 15 }],
      'center',
    );
    const html = resumeHtml({ id: 'teste', name: 'Teste <1>', markdown, layout });
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<title>Teste &lt;1&gt;</title>');
    expect(html).toContain('--cv-font-family: "Georgia", serif;');
    expect(html).toContain('--cv-accent: #123456;');
    expect(html).toContain('--cv-h2: #abcdef;');
    expect(html).toContain('@page { size: A4; margin: 20mm; }');
    expect(html).toMatch(/<p data-block-start="10" data-block-end="15" style="text-align:center">Cargo<\/p>/);
    // Raw HTML in the Markdown is not rendered, as in the studio.
    expect(html).not.toContain('<b>sem HTML</b>');
    // The same resume.css as the studio.
    expect(html).toContain(':is(.resume, .markdown-rendered) h1');
  });

  it('conta as páginas do PDF gerado pelo Chromium', () => {
    const pdf = Buffer.from('<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page >>', 'latin1');
    expect(countPages(pdf)).toBe(2);
  });
});

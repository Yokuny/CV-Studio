import {
  defaultLayout,
  elementColors,
  elementColorValue,
  elementFonts,
  fontFamilyCss,
  fonts,
  layoutCss,
  remapBlockAlignments,
  slugify,
  textAlignments,
  validLayout,
  validResume,
} from '@cv-studio/core/model';
import { describe, expect, it } from 'vitest';
import { revision } from '../apps/api/src/repository';

const resume = {
  id: 'base',
  name: 'Currículo base',
  markdown: '# Felipe',
  layout: defaultLayout,
};
describe('arquivos de currículo', () => {
  it('impede caminhos fora do diretório e conteúdo inválido', () => {
    expect(validResume(resume)).toBe(true);
    for (const id of ['../base', 'base/../../secrets', '.hidden', 'x.md', ''])
      expect(validResume({ ...resume, id })).toBe(false);
    expect(validResume({ ...resume, markdown: 'a'.repeat(250001) })).toBe(false);
  });
  it('rejeita tokens que injetam CSS ou quebram os limites de diagramação', () => {
    expect(validLayout(defaultLayout)).toBe(true);
    expect(validLayout({ ...defaultLayout, fontFamily: 'Arial; display:none' })).toBe(false);
    expect(validLayout({ ...defaultLayout, fontSize: 2 })).toBe(false);
    expect(validLayout({ ...defaultLayout, margin: Infinity })).toBe(false);
    expect(validLayout({ ...defaultLayout, textColor: 'red;display:none' })).toBe(false);
  });
  it('valida cores por elemento sem alterar a herança de layouts antigos', () => {
    expect(layoutCss(defaultLayout)).not.toHaveProperty('--cv-h1');
    for (const { key } of elementColors) {
      const layout = { ...defaultLayout, elementColors: { [key]: '#123abc' } };
      expect(validLayout(layout)).toBe(true);
      expect(layoutCss(layout)).toHaveProperty(`--cv-${key}`, '#123abc');
      expect(elementColorValue(layout, key)).toBe('#123abc');
      expect(revision({ ...resume, layout })).not.toBe(revision(resume));
      expect(validLayout({ ...defaultLayout, elementColors: { [key]: 'red;display:none' } })).toBe(false);
    }
    for (const elementColors of [null, [], '#abcdef', { unknown: '#abcdef' }, { h1: null }])
      expect(validLayout({ ...defaultLayout, elementColors })).toBe(false);
    expect(elementColorValue({ ...defaultLayout, accentColor: '#ff0000' }, 'h1')).toBe('#ff0000');
    expect(elementColorValue(defaultLayout, 'code-block-background')).toBe('#f2f2f2');
    expect(elementColorValue({ ...defaultLayout, accentColor: '#000000' }, 'table-header-background')).toBe('#f0f0f0');
  });
  it('aceita fontes por elemento e layouts antigos, rejeitando famílias e chaves inválidas', () => {
    expect(validLayout(defaultLayout)).toBe(true);
    expect(layoutCss(defaultLayout)).not.toHaveProperty('--cv-h1-font');
    for (const { key } of elementFonts) {
      for (const font of fonts) {
        const layout = { ...defaultLayout, elementFonts: { [key]: font } };
        expect(validLayout(layout)).toBe(true);
        expect(layoutCss(layout)).toHaveProperty(`--cv-${key}-font`, fontFamilyCss(font));
      }
    }
    for (const elementFonts of [
      null,
      [],
      'Arial',
      { unknown: 'Arial' },
      { h1: null },
      { h1: 'Arial;display:none' },
      { h1: 'Unknown' },
    ])
      expect(validLayout({ ...defaultLayout, elementFonts })).toBe(false);
    expect(revision(resume)).not.toBe(
      revision({ ...resume, layout: { ...defaultLayout, elementFonts: { h1: 'Georgia' } } }),
    );
    expect(layoutCss({ ...defaultLayout, fontFamily: 'Consolas' })['--cv-font-family']).toBe('"Consolas", monospace');
  });
  it('normaliza nomes e detecta alterações de conteúdo, layout e nome', () => {
    expect(slugify('Backend Sênior / São Paulo')).toBe('backend-senior-sao-paulo');
    expect(slugify(`${'a'.repeat(59)} empresa`)).toBe('a'.repeat(59));
    expect(revision(resume)).not.toBe(revision({ ...resume, markdown: '# Outro' }));
    expect(revision(resume)).not.toBe(revision({ ...resume, layout: { ...defaultLayout, fontSize: 11 } }));
    expect(revision(resume)).not.toBe(revision({ ...resume, name: 'Outra versão' }));
  });
  it('aceita layouts antigos e restringe o alinhamento aos valores suportados', () => {
    const { textAlign: _textAlign, ...legacy } = defaultLayout;
    expect(validLayout(legacy)).toBe(true);
    expect(layoutCss(legacy)['--cv-text-align']).toBe('left');
    for (const textAlign of textAlignments) expect(validLayout({ ...legacy, textAlign })).toBe(true);
    for (const textAlign of ['justify;display:none', 'between', null, 1])
      expect(validLayout({ ...legacy, textAlign })).toBe(false);
    expect(revision(resume)).not.toBe(revision({ ...resume, layout: { ...defaultLayout, textAlign: 'justify' } }));
  });
  it('preserva o alinhamento de trechos ao editar e rejeita posições inválidas', () => {
    const before = 'Primeiro.\n\nSegundo.';
    const blocks = [{ start: 11, end: 19, align: 'justify' as const }];
    expect(remapBlockAlignments(blocks, before, `Novo.\n\n${before}`)).toEqual([
      { start: 18, end: 26, align: 'justify' },
    ]);
    expect(remapBlockAlignments(blocks, before, 'Primeiro.\n\nSegundo atualizado.')).toEqual([
      { start: 11, end: 30, align: 'justify' },
    ]);
    expect(remapBlockAlignments(blocks, before, 'Primeiro.\n\n')).toEqual([]);
    expect(validLayout({ ...defaultLayout, blockAlignments: blocks })).toBe(true);
    expect(validLayout({ ...defaultLayout, blockAlignments: [{ start: -1, end: 3, align: 'left' }] })).toBe(false);
    expect(validLayout({ ...defaultLayout, blockAlignments: [{ start: 0, end: 3, align: 'invalid' }] })).toBe(false);
    expect(
      remapBlockAlignments([{ ...blocks[0], source: 'Segundo.' }], before, 'Primeiro.\n\nSegundo atualizado.'),
    ).toEqual([{ start: 11, end: 30, align: 'justify', source: 'Segundo atualizado.' }]);
    expect(remapBlockAlignments([{ ...blocks[0], source: 'Outro...' }], before, before)).toEqual([]);
  });
  it('ignora metadados antigos da vaga ao validar e calcular revisão', () => {
    const legacy = { ...resume, job: 'Node.js e AWS' };
    expect(validResume(legacy)).toBe(true);
    expect(revision(legacy)).toBe(revision(resume));
  });
});

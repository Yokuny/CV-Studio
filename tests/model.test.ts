import { describe, expect, it } from 'vitest'
import { revision } from '../server/resumes'
import {
  defaultLayout,
  layoutCss,
  remapBlockAlignments,
  slugify,
  textAlignments,
  validLayout,
  validResume,
} from '../src/lib/model'

const resume = {
  id: 'base',
  name: 'Currículo base',
  markdown: '# Felipe',
  layout: defaultLayout,
}
describe('arquivos de currículo', () => {
  it('impede caminhos fora do diretório e conteúdo inválido', () => {
    expect(validResume(resume)).toBe(true)
    for (const id of ['../base', 'base/../../secrets', '.hidden', 'x.md', ''])
      expect(validResume({ ...resume, id })).toBe(false)
    expect(validResume({ ...resume, markdown: 'a'.repeat(250001) })).toBe(false)
  })
  it('rejeita tokens que injetam CSS ou quebram os limites de diagramação', () => {
    expect(validLayout(defaultLayout)).toBe(true)
    expect(validLayout({ ...defaultLayout, fontFamily: 'Arial; display:none' })).toBe(false)
    expect(validLayout({ ...defaultLayout, fontSize: 2 })).toBe(false)
    expect(validLayout({ ...defaultLayout, margin: Infinity })).toBe(false)
    expect(validLayout({ ...defaultLayout, textColor: 'red;display:none' })).toBe(false)
  })
  it('normaliza nomes e detecta alterações de conteúdo, layout e nome', () => {
    expect(slugify('Backend Sênior / São Paulo')).toBe('backend-senior-sao-paulo')
    expect(slugify(`${'a'.repeat(59)} empresa`)).toBe('a'.repeat(59))
    expect(revision(resume)).not.toBe(revision({ ...resume, markdown: '# Outro' }))
    expect(revision(resume)).not.toBe(
      revision({ ...resume, layout: { ...defaultLayout, fontSize: 11 } }),
    )
    expect(revision(resume)).not.toBe(revision({ ...resume, name: 'Outra versão' }))
  })
  it('aceita layouts antigos e restringe o alinhamento aos valores suportados', () => {
    const { textAlign: _textAlign, ...legacy } = defaultLayout
    expect(validLayout(legacy)).toBe(true)
    expect(layoutCss(legacy)['--cv-text-align']).toBe('left')
    for (const textAlign of textAlignments) expect(validLayout({ ...legacy, textAlign })).toBe(true)
    for (const textAlign of ['justify;display:none', 'between', null, 1])
      expect(validLayout({ ...legacy, textAlign })).toBe(false)
    expect(revision(resume)).not.toBe(
      revision({ ...resume, layout: { ...defaultLayout, textAlign: 'justify' } }),
    )
  })
  it('preserva o alinhamento de trechos ao editar e rejeita posições inválidas', () => {
    const before = 'Primeiro.\n\nSegundo.'
    const blocks = [{ start: 11, end: 19, align: 'justify' as const }]
    expect(remapBlockAlignments(blocks, before, `Novo.\n\n${before}`)).toEqual([
      { start: 18, end: 26, align: 'justify' },
    ])
    expect(remapBlockAlignments(blocks, before, 'Primeiro.\n\nSegundo atualizado.')).toEqual([
      { start: 11, end: 30, align: 'justify' },
    ])
    expect(remapBlockAlignments(blocks, before, 'Primeiro.\n\n')).toEqual([])
    expect(validLayout({ ...defaultLayout, blockAlignments: blocks })).toBe(true)
    expect(
      validLayout({ ...defaultLayout, blockAlignments: [{ start: -1, end: 3, align: 'left' }] }),
    ).toBe(false)
    expect(
      validLayout({ ...defaultLayout, blockAlignments: [{ start: 0, end: 3, align: 'invalid' }] }),
    ).toBe(false)
    expect(
      remapBlockAlignments(
        [{ ...blocks[0], source: 'Segundo.' }],
        before,
        'Primeiro.\n\nSegundo atualizado.',
      ),
    ).toEqual([{ start: 11, end: 30, align: 'justify', source: 'Segundo atualizado.' }])
    expect(remapBlockAlignments([{ ...blocks[0], source: 'Outro...' }], before, before)).toEqual([])
  })
  it('ignora metadados antigos da vaga ao validar e calcular revisão', () => {
    const legacy = { ...resume, job: 'Node.js e AWS' }
    expect(validResume(legacy)).toBe(true)
    expect(revision(legacy)).toBe(revision(resume))
  })
})

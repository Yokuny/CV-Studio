import { describe, expect, it } from 'vitest'
import { revision } from '../server/resumes'
import { defaultLayout, slugify, validLayout, validResume } from '../src/lib/model'

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
  it('ignora metadados antigos da vaga ao validar e calcular revisão', () => {
    const legacy = { ...resume, job: 'Node.js e AWS' }
    expect(validResume(legacy)).toBe(true)
    expect(revision(legacy)).toBe(revision(resume))
  })
})

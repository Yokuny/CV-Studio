import { describe, expect, it } from 'vitest'
import { revision } from '../server/resumes'
import {
  adaptationPrompt,
  defaultLayout,
  slugify,
  validLayout,
  validResume,
} from '../src/lib/model'

const resume = {
  id: 'base',
  name: 'Currículo base',
  markdown: '# Felipe',
  job: '',
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
  it('normaliza nomes e detecta alterações de conteúdo, layout e contexto', () => {
    expect(slugify('Backend Sênior / São Paulo')).toBe('backend-senior-sao-paulo')
    expect(slugify(`${'a'.repeat(59)} empresa`)).toBe('a'.repeat(59))
    expect(revision(resume)).not.toBe(revision({ ...resume, markdown: '# Outro' }))
    expect(revision(resume)).not.toBe(
      revision({ ...resume, layout: { ...defaultLayout, fontSize: 11 } }),
    )
    expect(revision(resume)).not.toBe(revision({ ...resume, job: 'Node.js' }))
  })
  it('prepara contexto real e destino de variante, preservando o base', () => {
    const prompt = adaptationPrompt({ ...resume, job: 'Node.js e AWS' })
    expect(prompt).toContain('Node.js e AWS')
    expect(prompt).toContain('# Felipe')
    expect(prompt).toContain('content/cv/<slug-da-vaga>.md')
  })
})

export const fonts = ['Arial', 'Georgia', 'Verdana', 'Times New Roman', 'Helvetica'] as const
export interface Layout {
  fontFamily: (typeof fonts)[number]
  fontSize: number
  lineHeight: number
  sectionGap: number
  paragraphGap: number
  margin: number
  headingSize: number
  accentColor: string
  textColor: string
  paperColor: string
}
export interface Resume {
  id: string
  name: string
  markdown: string
  layout: Layout
  job: string
}
export const defaultLayout: Layout = {
  fontFamily: 'Arial',
  fontSize: 10,
  lineHeight: 1.45,
  sectionGap: 16,
  paragraphGap: 6,
  margin: 16,
  headingSize: 24,
  accentColor: '#1d1d1f',
  textColor: '#333336',
  paperColor: '#ffffff',
}
export const layoutRanges = {
  fontSize: [8, 14, 0.5],
  lineHeight: [1.1, 2, 0.05],
  sectionGap: [8, 32, 1],
  paragraphGap: [2, 16, 1],
  margin: [8, 28, 1],
  headingSize: [18, 36, 1],
} as const
export function validLayout(value: unknown): value is Layout {
  if (!value || typeof value !== 'object') return false
  const l = value as Record<string, unknown>
  return (
    fonts.includes(l.fontFamily as Layout['fontFamily']) &&
    Object.entries(layoutRanges).every(
      ([key, [min, max]]) =>
        typeof l[key] === 'number' &&
        Number.isFinite(l[key]) &&
        (l[key] as number) >= min &&
        (l[key] as number) <= max,
    ) &&
    ['accentColor', 'textColor', 'paperColor'].every(
      (key) => typeof l[key] === 'string' && /^#[a-f\d]{6}$/i.test(l[key] as string),
    )
  )
}
export function validResume(value: unknown): value is Resume {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.id) &&
    r.id.length <= 80 &&
    typeof r.name === 'string' &&
    r.name.length > 0 &&
    r.name.length <= 120 &&
    typeof r.markdown === 'string' &&
    r.markdown.length <= 250000 &&
    typeof r.job === 'string' &&
    r.job.length <= 50000 &&
    validLayout(r.layout)
  )
}
export function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '')
}
export function layoutCss(layout: Layout) {
  return {
    '--cv-font-family': `"${layout.fontFamily}", serif`,
    '--cv-font-size': `${layout.fontSize}pt`,
    '--cv-line-height': layout.lineHeight,
    '--cv-section-gap': `${layout.sectionGap}px`,
    '--cv-paragraph-gap': `${layout.paragraphGap}px`,
    '--cv-margin': `${layout.margin}mm`,
    '--cv-heading-size': `${layout.headingSize}pt`,
    '--cv-accent': layout.accentColor,
    '--cv-text': layout.textColor,
    '--cv-paper': layout.paperColor,
  }
}
export function adaptationPrompt(resume: Resume) {
  return `Use a skill cv-tailor deste repositório. Leia content/cv/base.md e preserve os fatos. Adapte o currículo para a vaga abaixo, usando palavras-chave apenas quando sustentadas por experiências reais. Não invente tecnologias, métricas, datas ou cargos. Salve o resultado em content/cv/${resume.id === 'base' ? '<slug-da-vaga>' : resume.id}.md e mantenha os ajustes de layout separados. Liste requisitos atendidos, lacunas e alterações para revisão.\n\nVAGA\n${resume.job}\n\nCURRÍCULO ATUAL\n${resume.markdown}`
}

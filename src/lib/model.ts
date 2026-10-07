export const fonts = ['Arial', 'Georgia', 'Verdana', 'Times New Roman', 'Helvetica'] as const
export const textAlignments = ['left', 'center', 'right', 'justify'] as const
export type TextAlignment = (typeof textAlignments)[number]
export interface BlockAlignment {
  start: number
  end: number
  align: TextAlignment
  source?: string
}
export interface Layout {
  fontFamily: (typeof fonts)[number]
  textAlign?: (typeof textAlignments)[number]
  blockAlignments?: BlockAlignment[]
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
}
export const defaultLayout: Layout = {
  fontFamily: 'Arial',
  textAlign: 'left',
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
    (l.textAlign === undefined ||
      textAlignments.includes(l.textAlign as (typeof textAlignments)[number])) &&
    (l.blockAlignments === undefined ||
      (Array.isArray(l.blockAlignments) &&
        l.blockAlignments.length <= 5000 &&
        l.blockAlignments.every(
          (block) =>
            block &&
            Number.isInteger(block.start) &&
            Number.isInteger(block.end) &&
            block.start >= 0 &&
            block.end > block.start &&
            block.end <= 250000 &&
            (block.source === undefined ||
              (typeof block.source === 'string' &&
                block.source.length === block.end - block.start)) &&
            textAlignments.includes(block.align),
        ))) &&
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
    validLayout(r.layout)
  )
}

export function remapBlockAlignments(
  blocks: BlockAlignment[],
  before: string,
  after: string,
): BlockAlignment[] {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  let oldEnd = before.length
  let newEnd = after.length
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--
    newEnd--
  }
  const delta = after.length - before.length
  return blocks.flatMap((block) => {
    if (block.source !== undefined && before.slice(block.start, block.end) !== block.source)
      return []
    if (block.end <= start) return [block]
    if (block.start >= oldEnd)
      return [{ ...block, start: block.start + delta, end: block.end + delta }]
    // A change contained in one paragraph preserves its alignment. Removed or
    // replaced blocks lose the override rather than applying it to other text.
    if (start >= block.start && oldEnd <= block.end && newEnd > block.start)
      return [
        {
          ...block,
          end: block.end + delta,
          ...(block.source !== undefined
            ? { source: after.slice(block.start, block.end + delta) }
            : {}),
        },
      ]
    return []
  })
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
    '--cv-text-align': layout.textAlign ?? 'left',
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

export const fonts = [
  'Arial',
  'Georgia',
  'Verdana',
  'Times New Roman',
  'Helvetica',
  'Courier New',
  'Consolas',
] as const
export const textAlignments = ['left', 'center', 'right', 'justify'] as const
export type TextAlignment = (typeof textAlignments)[number]
export interface BlockAlignment {
  start: number
  end: number
  align: TextAlignment
  source?: string
}
export type FontFamily = (typeof fonts)[number]
export const elementFontGroups = [
  {
    label: 'Títulos',
    elements: [
      { key: 'h1', label: 'Título H1' },
      { key: 'h2', label: 'Título H2' },
      { key: 'h3', label: 'Título H3' },
      { key: 'h4', label: 'Título H4' },
      { key: 'h5', label: 'Título H5' },
      { key: 'h6', label: 'Título H6' },
      { key: 'subtitle', label: 'Subtítulo após H1' },
    ],
  },
  {
    label: 'Texto e listas',
    elements: [
      { key: 'paragraph', label: 'Parágrafos' },
      { key: 'strong', label: 'Negrito' },
      { key: 'em', label: 'Itálico' },
      { key: 'del', label: 'Texto riscado' },
      { key: 'link', label: 'Links' },
      { key: 'list', label: 'Texto das listas' },
      { key: 'marker', label: 'Marcadores e números' },
    ],
  },
  {
    label: 'Tabelas',
    elements: [
      { key: 'table-text', label: 'Texto das células' },
      { key: 'table-header-text', label: 'Texto do cabeçalho' },
    ],
  },
  {
    label: 'Citações e código',
    elements: [
      { key: 'quote', label: 'Citações' },
      { key: 'code', label: 'Código inline' },
      { key: 'code-block', label: 'Blocos de código' },
    ],
  },
] as const
export type ElementFont = (typeof elementFontGroups)[number]['elements'][number]['key']
export const elementFonts = elementFontGroups.flatMap((group) => [...group.elements])
export function fontFamilyCss(font: FontFamily) {
  const fallback = font === 'Courier New' || font === 'Consolas' ? 'monospace' : 'serif'
  return `"${font}", ${fallback}`
}

// Optional element colors preserve the inheritance of existing layouts.
export const elementColorGroups = [
  {
    label: 'Títulos',
    colors: [
      { key: 'h1', label: 'Título H1', base: 'accentColor' },
      { key: 'h2', label: 'Título H2', base: 'accentColor' },
      { key: 'h3', label: 'Título H3', base: 'accentColor' },
      { key: 'h4', label: 'Título H4', base: 'textColor' },
      { key: 'h5', label: 'Título H5', base: 'textColor' },
      { key: 'h6', label: 'Título H6', base: 'textColor' },
      { key: 'subtitle', label: 'Subtítulo após H1', base: 'accentColor' },
      { key: 'heading-border', label: 'Linha do H2', base: 'accentColor', opacity: 0.3 },
    ],
  },
  {
    label: 'Texto e listas',
    colors: [
      { key: 'paragraph', label: 'Parágrafos', base: 'textColor' },
      { key: 'strong', label: 'Negrito', base: 'textColor' },
      { key: 'em', label: 'Itálico', base: 'textColor' },
      { key: 'del', label: 'Texto riscado', base: 'textColor' },
      { key: 'link', label: 'Links', base: 'accentColor' },
      { key: 'list', label: 'Texto das listas', base: 'textColor' },
      { key: 'marker', label: 'Marcadores e números', base: 'accentColor' },
      { key: 'checkbox', label: 'Caixas de tarefas', base: 'accentColor' },
      { key: 'rule', label: 'Linha horizontal', base: 'accentColor' },
    ],
  },
  {
    label: 'Tabelas',
    colors: [
      { key: 'table-text', label: 'Texto das células', base: 'textColor' },
      { key: 'table-background', label: 'Fundo das células', base: 'paperColor' },
      { key: 'table-header-text', label: 'Texto do cabeçalho', base: 'textColor' },
      {
        key: 'table-header-background',
        label: 'Fundo do cabeçalho',
        base: 'accentColor',
        opacity: 0.06,
      },
      { key: 'table-border', label: 'Linhas da tabela', base: 'textColor', opacity: 0.09 },
      { key: 'table-stripe', label: 'Fundo das linhas alternadas', base: 'paperColor' },
    ],
  },
  {
    label: 'Citações e código',
    colors: [
      { key: 'quote-text', label: 'Texto da citação', base: 'textColor' },
      { key: 'quote-background', label: 'Fundo da citação', base: 'paperColor' },
      { key: 'quote-border', label: 'Borda da citação', base: 'accentColor' },
      { key: 'code-text', label: 'Texto do código inline', base: 'textColor' },
      { key: 'code-background', label: 'Fundo do código inline', base: 'paperColor' },
      { key: 'code-block-text', label: 'Texto do bloco de código', base: 'textColor' },
      {
        key: 'code-block-background',
        label: 'Fundo do bloco de código',
        base: 'paperColor',
        fixed: '#f2f2f2',
      },
    ],
  },
] as const
export type ElementColor = (typeof elementColorGroups)[number]['colors'][number]['key']
export const elementColors = elementColorGroups.flatMap((group) => [...group.colors])

export function elementColorValue(layout: Layout, key: ElementColor): string {
  const override = layout.elementColors?.[key]
  if (override) return override
  const token = elementColors.find((color) => color.key === key)
  if (!token) return layout.textColor
  if ('fixed' in token) return token.fixed
  const base = layout[token.base]
  if (!('opacity' in token)) return base
  // Show the effective default swatch for translucent borders and backgrounds.
  return `#${[1, 3, 5]
    .map((start) =>
      Math.round(
        Number.parseInt(base.slice(start, start + 2), 16) * token.opacity +
          Number.parseInt(layout.paperColor.slice(start, start + 2), 16) * (1 - token.opacity),
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

export interface Layout {
  elementColors?: Partial<Record<ElementColor, string>>
  elementFonts?: Partial<Record<ElementFont, FontFamily>>
  fontFamily: FontFamily
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
    (l.elementColors === undefined ||
      (l.elementColors !== null &&
        typeof l.elementColors === 'object' &&
        !Array.isArray(l.elementColors) &&
        Object.entries(l.elementColors).every(
          ([key, value]) =>
            elementColors.some((color) => color.key === key) &&
            typeof value === 'string' &&
            /^#[a-f\d]{6}$/i.test(value),
        ))) &&
    (l.elementFonts === undefined ||
      (l.elementFonts !== null &&
        typeof l.elementFonts === 'object' &&
        !Array.isArray(l.elementFonts) &&
        Object.entries(l.elementFonts).every(
          ([key, value]) =>
            elementFonts.some((element) => element.key === key) &&
            fonts.includes(value as FontFamily),
        ))) &&
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
    ...Object.fromEntries(
      elementColors.flatMap(({ key }) => {
        const color = layout.elementColors?.[key]
        return color ? [[`--cv-${key}`, color]] : []
      }),
    ),
    ...Object.fromEntries(
      elementFonts.flatMap(({ key }) => {
        const font = layout.elementFonts?.[key]
        return font ? [[`--cv-${key}-font`, fontFamilyCss(font)]] : []
      }),
    ),
    '--cv-font-family': fontFamilyCss(layout.fontFamily),
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
export function findBlockAlignment(
  layout: Layout,
  markdown: string,
  start: number | undefined,
  end: number | undefined,
) {
  return layout.blockAlignments?.find(
    (block) =>
      block.start === start &&
      block.end === end &&
      (block.source === undefined || block.source === markdown.slice(block.start, block.end)),
  )
}
export function alignBlocks(
  layout: Layout,
  markdown: string,
  blocks: Pick<BlockAlignment, 'start' | 'end'>[],
  align: TextAlignment,
): Layout {
  return {
    ...layout,
    blockAlignments: [
      ...(layout.blockAlignments ?? []).filter(
        (block) => !blocks.some((selected) => selected.start === block.start),
      ),
      ...blocks.map((block) => ({
        ...block,
        align,
        source: markdown.slice(block.start, block.end),
      })),
    ].sort((a, b) => a.start - b.start),
  }
}
export function layoutCssDeclarations(layout: Layout, indent = '') {
  return Object.entries(layoutCss(layout))
    .map(([key, value]) => `${indent}${key}: ${value};`)
    .join('\n')
}

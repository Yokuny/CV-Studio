import { type CSSProperties, lazy, Suspense } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { type Layout, layoutCss } from '@/lib/model'

const MarkdownEditor = lazy(() => import('@/components/markdown-editor'))

/** Editable views of the Markdown source: the visual editor or the raw text. */
export function SourcePreview({
  mode,
  versionId,
  name,
  markdown,
  layout,
  scale,
  width,
  onChange,
}: {
  mode: 'markdown' | 'text'
  versionId: string
  name: string
  markdown: string
  layout: Layout
  scale: number
  width: number
  onChange: (markdown: string) => void
}) {
  const rendered = mode === 'markdown'
  return (
    <section
      className={`markdown-preview ${rendered ? 'rendered-preview ' : ''}no-print`}
      style={{ ...layoutCss(layout), width } as CSSProperties}
      aria-label={`${rendered ? 'Markdown' : 'Edição'} de ${name}`}
    >
      {rendered ? (
        <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Abrindo editor…</p>}>
          <MarkdownEditor key={versionId} value={markdown} onChange={onChange} scale={scale} />
        </Suspense>
      ) : (
        <Textarea
          className="source-editor"
          aria-label="Editar código Markdown"
          value={markdown}
          onChange={(event) => onChange(event.target.value)}
          style={{ zoom: scale }}
          spellCheck={false}
        />
      )}
    </section>
  )
}

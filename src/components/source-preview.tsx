import { type CSSProperties, lazy, Suspense } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { layoutCss } from '@/lib/model'
import { pageWidth } from '@/lib/page'
import { selectCurrent, useResumes } from '@/store/resumes'
import { selectScale, useUi } from '@/store/ui'

const MarkdownEditor = lazy(() => import('@/components/markdown-editor'))

/** Editable views of the Markdown source: the visual editor or the raw text. */
export function SourcePreview({ mode }: { mode: 'markdown' | 'text' }) {
  const { id, name, markdown, layout } = useResumes(selectCurrent)
  const update = useResumes((s) => s.update)
  const scale = useUi(selectScale)
  const onChange = (markdown: string) => update({ markdown })
  const rendered = mode === 'markdown'
  return (
    <section
      className={`markdown-preview ${rendered ? 'rendered-preview ' : ''}no-print`}
      style={{ ...layoutCss(layout), width: pageWidth * scale } as CSSProperties}
      aria-label={`${rendered ? 'Markdown' : 'Edição'} de ${name}`}
    >
      {rendered ? (
        <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Abrindo editor…</p>}>
          <MarkdownEditor key={id} value={markdown} onChange={onChange} scale={scale} />
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

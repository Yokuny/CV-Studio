import { FileText } from 'lucide-react'
import type { PreviewMode } from '@/components/view-switch'

const modeLabels: Record<PreviewMode, string> = {
  pdf: 'Prévia final · PDF',
  markdown: 'Markdown',
  text: 'Edição',
}

export function PaperInfo({
  name,
  preview,
  pages,
  width,
}: {
  name: string
  preview: PreviewMode
  pages: number
  width: number
}) {
  return (
    <div className="paper-info no-print" style={{ width }}>
      <div className="paper-document">
        <h1 title={name}>{name}</h1>
        <span className="preview-badge">
          <span className="status-dot" />
          {modeLabels[preview]}
        </span>
      </div>
      <div className="paper-metadata">
        <FileText size={14} />
        <strong>A4</strong>
        <span className="toolbar-divider" />
        <span>210 × 297 mm</span>
        <span className="page-estimate">
          · ~{pages} {pages === 1 ? 'página' : 'páginas'}
        </span>
      </div>
    </div>
  )
}

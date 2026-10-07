import { FileText } from 'lucide-react';
import { estimatePages, pageWidth } from '@/lib/page';
import { selectCurrent, useResumes } from '@/store/resumes';
import { type PreviewMode, selectScale, useUi } from '@/store/ui';

const modeLabels: Record<PreviewMode, string> = {
  pdf: 'Prévia final · PDF',
  markdown: 'Markdown',
  text: 'Edição',
};

export function PaperInfo() {
  const { name, layout } = useResumes(selectCurrent);
  const preview = useUi((s) => s.preview);
  const scale = useUi(selectScale);
  const pages = useUi((s) => estimatePages(s.metrics.paperHeight, layout.margin));
  return (
    <div className="paper-info no-print" style={{ width: pageWidth * scale }}>
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
  );
}

import { FileText } from 'lucide-react';
import { estimatePages } from '@/lib/page';
import { selectCurrent, useResumes } from '@/store/resumes';
import { useUi } from '@/store/ui';

export function PaperInfo() {
  const layout = useResumes((s) => selectCurrent(s).layout);
  const pages = useUi((s) => estimatePages(s.metrics.paperHeight, layout.margin));
  return (
    <div className="paper-metadata">
      <FileText size={14} />
      <strong>A4</strong>
      <span className="toolbar-divider" />
      <span>210 × 297 mm</span>
      <span className="page-estimate">
        · ~{pages} {pages === 1 ? 'página' : 'páginas'}
      </span>
    </div>
  );
}

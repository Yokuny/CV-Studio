import type { Ref, RefObject } from 'react'
import { AlignmentControls } from '@/components/alignment-controls'
import { EmptyWorkspace } from '@/components/empty-workspace'
import { ExportHelp } from '@/components/export-help'
import { PaperInfo } from '@/components/paper-info'
import { ResumePaper } from '@/components/resume-paper'
import { SourcePreview } from '@/components/source-preview'
import { StaticBanner } from '@/components/static-banner'
import { versionTabId } from '@/components/version-tab'
import { ZoomControls } from '@/components/zoom-controls'
import { useBlockSelection } from '@/hooks/use-block-selection'
import { pageWidth } from '@/lib/page'
import { selectCurrent, selectHasVersion, useResumes } from '@/store/resumes'
import { selectScale, useUi } from '@/store/ui'

export function Workspace({
  ref,
  paperRef,
}: {
  ref?: Ref<HTMLElement>
  paperRef: RefObject<HTMLElement | null>
}) {
  const { id, markdown } = useResumes(selectCurrent)
  const hasVersion = useResumes(selectHasVersion)
  const preview = useUi((s) => s.preview)
  const scale = useUi(selectScale)
  const selectedBlocks = useBlockSelection(paperRef, id, markdown.length, preview === 'pdf')

  return (
    <main
      className={`workspace ${preview !== 'pdf' ? 'source-view' : ''}`}
      ref={ref}
      id="resume-panel"
      role="tabpanel"
      aria-labelledby={hasVersion ? versionTabId(id) : undefined}
    >
      {!hasVersion && <EmptyWorkspace />}
      {hasVersion && (
        <>
          <div
            className="document-toolbar no-print"
            role="toolbar"
            aria-label="Zoom do currículo"
            style={{ width: pageWidth * scale }}
          >
            {preview === 'pdf' && <AlignmentControls selectedBlocks={selectedBlocks} />}
            <ZoomControls />
          </div>
          <PaperInfo />
          {preview !== 'pdf' && <SourcePreview mode={preview} />}
        </>
      )}
      <ResumePaper ref={paperRef} />
      <ExportHelp />
      <StaticBanner />
    </main>
  )
}

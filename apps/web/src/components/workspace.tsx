import type { Ref, RefObject } from 'react';
import { AlignmentControls } from '@/components/alignment-controls';
import { ConflictBanner } from '@/components/conflict-banner';
import { EmptyWorkspace } from '@/components/empty-workspace';
import { ExportHelp } from '@/components/export-help';
import { JobsPanel } from '@/components/jobs-panel';
import { PaperInfo } from '@/components/paper-info';
import { PitchEditor, PitchStatus } from '@/components/pitch-editor';
import { ResumePaper } from '@/components/resume-paper';
import { SourcePreview } from '@/components/source-preview';
import { StaticBanner } from '@/components/static-banner';
import { versionTabId } from '@/components/version-tab';
import { ZoomControls } from '@/components/zoom-controls';
import { useBlockSelection } from '@/hooks/use-block-selection';
import { pageWidth } from '@/lib/page';
import { selectCurrent, selectHasVersion, useResumes } from '@/store/resumes';
import { selectScale, useUi } from '@/store/ui';

export function Workspace({ ref, paperRef }: { ref?: Ref<HTMLElement>; paperRef: RefObject<HTMLElement | null> }) {
  const { id, markdown } = useResumes(selectCurrent);
  const hasVersion = useResumes(selectHasVersion);
  const preview = useUi((s) => s.preview);
  const scale = useUi(selectScale);
  const selectedBlocks = useBlockSelection(paperRef, id, markdown.length, preview === 'pdf');

  return (
    <main
      className={`workspace ${preview !== 'pdf' ? 'source-view' : ''}`}
      ref={ref}
      id="resume-panel"
      role="tabpanel"
      aria-labelledby={hasVersion ? versionTabId(id) : undefined}
    >
      {preview === 'jobs' && <JobsPanel />}
      {!hasVersion && preview !== 'jobs' && <EmptyWorkspace />}
      {hasVersion && preview !== 'jobs' && (
        <>
          <div className="document-header no-print" style={{ width: pageWidth * scale }}>
            <div className="document-toolbar" role="toolbar" aria-label="Zoom do currículo">
              <div className="document-toolbar-status">
                {preview === 'pitch' ? (
                  <PitchStatus />
                ) : (
                  <>
                    <ConflictBanner />
                    <PaperInfo />
                  </>
                )}
              </div>
              <div className="document-toolbar-controls">
                {preview === 'pdf' && <AlignmentControls selectedBlocks={selectedBlocks} />}
                <ZoomControls />
              </div>
            </div>
          </div>
          {(preview === 'markdown' || preview === 'text') && <SourcePreview mode={preview} />}
          {preview === 'pitch' && <PitchEditor />}
        </>
      )}
      <ResumePaper ref={paperRef} />
      <ExportHelp />
      <StaticBanner />
    </main>
  );
}

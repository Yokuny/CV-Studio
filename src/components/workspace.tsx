import type { Ref, RefObject } from 'react'
import { AlignmentControls } from '@/components/alignment-controls'
import { EmptyWorkspace } from '@/components/empty-workspace'
import { ExportHelp } from '@/components/export-help'
import { PaperInfo } from '@/components/paper-info'
import { ResumePaper } from '@/components/resume-paper'
import { SourcePreview } from '@/components/source-preview'
import { StaticBanner } from '@/components/static-banner'
import { versionTabId } from '@/components/version-tab'
import type { PreviewMode } from '@/components/view-switch'
import { ZoomControls } from '@/components/zoom-controls'
import { useBlockSelection } from '@/hooks/use-block-selection'
import { alignBlocks, type TextAlignment } from '@/lib/model'
import { estimatePages, pageWidth } from '@/lib/page'
import type { Version } from '@/lib/repository'

export function Workspace({
  ref,
  paperRef,
  version,
  hasVersion,
  preview,
  zoom,
  onZoomChange,
  scale,
  paperHeight,
  showStaticBanner,
  onUpdate,
  onNew,
  onDownload,
}: {
  ref?: Ref<HTMLElement>
  paperRef: RefObject<HTMLElement | null>
  version: Version
  hasVersion: boolean
  preview: PreviewMode
  zoom: number
  onZoomChange: (update: (zoom: number) => number) => void
  scale: number
  paperHeight: number
  showStaticBanner: boolean
  onUpdate: (change: (v: Version) => Partial<Version>) => void
  onNew: () => void
  onDownload: () => void
}) {
  const selectedBlocks = useBlockSelection(
    paperRef,
    version.id,
    version.markdown.length,
    preview === 'pdf',
  )
  const width = pageWidth * scale
  const align = (alignment: TextAlignment) =>
    onUpdate((v) => ({ layout: alignBlocks(v.layout, v.markdown, selectedBlocks, alignment) }))

  return (
    <main
      className={`workspace ${preview !== 'pdf' ? 'source-view' : ''}`}
      ref={ref}
      id="resume-panel"
      role="tabpanel"
      aria-labelledby={hasVersion ? versionTabId(version.id) : undefined}
    >
      {!hasVersion && <EmptyWorkspace onNew={onNew} />}
      {hasVersion && (
        <>
          <div
            className="document-toolbar no-print"
            role="toolbar"
            aria-label="Zoom do currículo"
            style={{ width }}
          >
            {preview === 'pdf' && (
              <AlignmentControls
                layout={version.layout}
                markdown={version.markdown}
                selectedBlocks={selectedBlocks}
                onAlign={align}
              />
            )}
            <ZoomControls zoom={zoom} onChange={onZoomChange} />
          </div>
          <PaperInfo
            name={version.name}
            preview={preview}
            pages={estimatePages(paperHeight, version.layout.margin)}
            width={width}
          />
          {preview !== 'pdf' && (
            <SourcePreview
              mode={preview}
              versionId={version.id}
              name={version.name}
              markdown={version.markdown}
              layout={version.layout}
              scale={scale}
              width={width}
              onChange={(markdown) => onUpdate(() => ({ markdown }))}
            />
          )}
        </>
      )}
      <ResumePaper
        ref={paperRef}
        versionId={version.id}
        markdown={version.markdown}
        layout={version.layout}
        scale={scale}
        height={paperHeight}
        hidden={!hasVersion}
      />
      <ExportHelp hidden={!hasVersion || preview !== 'pdf'} />
      {showStaticBanner && <StaticBanner onDownload={onDownload} />}
    </main>
  )
}

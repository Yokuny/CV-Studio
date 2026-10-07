import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { DeleteVersionDialog } from '@/components/delete-version-dialog'
import { DesignPanel } from '@/components/design-panel'
import { NewVersionDialog } from '@/components/new-version-dialog'
import { ResumeActions } from '@/components/resume-actions'
import { Toast } from '@/components/toast'
import { VersionBar } from '@/components/version-bar'
import { type PreviewMode, ViewSwitch } from '@/components/view-switch'
import { Workspace } from '@/components/workspace'
import { defaultZoom } from '@/components/zoom-controls'
import { useLayoutMetrics } from '@/hooks/use-layout-metrics'
import { useNotice } from '@/hooks/use-notice'
import { useVersions } from '@/hooks/use-versions'
import { fitScale } from '@/lib/page'
import type { Version } from '@/lib/repository'

export default function App() {
  const [notice, setNotice] = useNotice()
  const studio = useVersions(setNotice)
  const { current, hasVersion, ready, writable, saving, deleting } = studio
  const [preview, setPreview] = useState<PreviewMode>('pdf')
  const [zoom, setZoom] = useState(defaultZoom)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [newOpen, setNewOpen] = useState(false)
  const [closing, setClosing] = useState<Version | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLElement>(null)
  const paperRef = useRef<HTMLElement>(null)
  const metrics = useLayoutMetrics({
    header: headerRef,
    tabs: tabsRef,
    workspace: workspaceRef,
    paper: paperRef,
  })
  const scale = fitScale(zoom, metrics.availableWidth)

  useEffect(() => {
    document.title = `${current.name} — CV Studio`
  }, [current.name])

  function requestClose(version: Version) {
    if (saving || deleting || !ready) return
    setClosing(version)
  }
  async function confirmClose() {
    if (!closing) return
    await studio.remove(closing)
    setClosing(null)
  }

  return (
    <div
      className="app-shell"
      style={
        {
          '--app-header-height': `${metrics.headerHeight}px`,
          '--action-header-height': `${metrics.actionHeight}px`,
        } as CSSProperties
      }
    >
      <style>{`@page { size: A4; margin: ${current.layout.margin}mm; }`}</style>
      <AppHeader ref={headerRef}>
        <ViewSwitch value={preview} onChange={setPreview} disabled={!ready || !hasVersion} />
        <ResumeActions
          disabled={!ready || !hasVersion}
          canImport={!deleting}
          canSave={writable && !saving && !deleting && studio.dirty}
          saving={saving}
          onImport={(file) => void studio.importMarkdown(file)}
          onDownload={studio.exportSources}
          onSave={studio.save}
        />
      </AppHeader>
      <VersionBar
        ref={tabsRef}
        versions={studio.versions}
        activeId={current.id}
        isDirty={studio.isDirty}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onSelect={studio.select}
        onClose={requestClose}
        onNew={() => setNewOpen(true)}
        closeDisabled={!ready || saving || deleting}
        newDisabled={!ready || deleting}
      />
      <div className={`studio-layout ${sidebarOpen && hasVersion ? '' : 'sidebar-collapsed'}`}>
        <aside
          id="editor-sidebar"
          className="sidebar no-print"
          hidden={!sidebarOpen || !hasVersion}
          aria-label="Ajustes do currículo"
        >
          <DesignPanel
            id={current.id}
            layout={current.layout}
            onChange={(change) => studio.update((v) => ({ layout: change(v.layout) }))}
          />
        </aside>
        <Workspace
          ref={workspaceRef}
          paperRef={paperRef}
          version={current}
          hasVersion={hasVersion}
          preview={preview}
          zoom={zoom}
          onZoomChange={setZoom}
          scale={scale}
          paperHeight={metrics.paperHeight}
          showStaticBanner={!writable && ready && hasVersion}
          onUpdate={studio.update}
          onNew={() => setNewOpen(true)}
          onDownload={studio.exportSources}
        />
      </div>
      <Toast message={notice} onClose={() => setNotice('')} />
      <DeleteVersionDialog
        version={closing}
        writable={writable}
        deleting={deleting}
        onCancel={() => setClosing(null)}
        onConfirm={confirmClose}
      />
      <NewVersionDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        sourceName={hasVersion ? current.name : undefined}
        onCreate={studio.create}
      />
    </div>
  )
}

import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { type Ref, useEffect } from 'react'
import { IconButton } from '@/components/icon-button'
import { Button } from '@/components/ui/button'
import { VersionTab, versionTabId } from '@/components/version-tab'
import { selectCurrent, selectDeleting, useResumes } from '@/store/resumes'
import { useUi } from '@/store/ui'

export function VersionBar({ ref }: { ref?: Ref<HTMLDivElement> }) {
  const versions = useResumes((s) => s.versions)
  const activeId = useResumes((s) => selectCurrent(s).id)
  const newDisabled = useResumes((s) => !s.ready || selectDeleting(s))
  const sidebarOpen = useUi((s) => s.sidebarOpen)
  const toggleSidebar = useUi((s) => s.toggleSidebar)
  const setNewVersionOpen = useUi((s) => s.setNewVersionOpen)

  useEffect(() => {
    document
      .getElementById(versionTabId(activeId))
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  return (
    <div ref={ref} className="version-bar no-print">
      <IconButton
        size="icon"
        className="sidebar-toggle"
        label={sidebarOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
        aria-expanded={sidebarOpen}
        aria-controls="editor-sidebar"
        onClick={toggleSidebar}
      >
        {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
      </IconButton>
      <div className="version-tabs" role="tablist" aria-label="Versões do currículo">
        {versions.map((version, index) => (
          <VersionTab key={version.id} version={version} index={index} />
        ))}
        <Button
          variant="ghost"
          className="new-version-tab"
          onClick={() => setNewVersionOpen(true)}
          disabled={newDisabled}
        >
          <Plus size={15} /> Nova Versão
        </Button>
      </div>
    </div>
  )
}

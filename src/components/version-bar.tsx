import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { type KeyboardEvent, type Ref, useEffect } from 'react'
import { IconButton } from '@/components/icon-button'
import { Button } from '@/components/ui/button'
import { VersionTab, versionTabId } from '@/components/version-tab'
import type { Version } from '@/lib/repository'

const navigationKeys: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
}

export function VersionBar({
  ref,
  versions,
  activeId,
  isDirty,
  sidebarOpen,
  onToggleSidebar,
  onSelect,
  onClose,
  onNew,
  closeDisabled,
  newDisabled,
}: {
  ref?: Ref<HTMLDivElement>
  versions: Version[]
  activeId: string
  isDirty: (version: Version) => boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onSelect: (id: string) => void
  onClose: (version: Version) => void
  onNew: () => void
  closeDisabled: boolean
  newDisabled: boolean
}) {
  useEffect(() => {
    document
      .getElementById(versionTabId(activeId))
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = navigationKeys[event.key]?.(index, versions.length)
    if (target === undefined) return
    event.preventDefault()
    onSelect(versions[target].id)
    document.getElementById(versionTabId(versions[target].id))?.focus()
  }

  const sidebarLabel = sidebarOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'
  return (
    <div ref={ref} className="version-bar no-print">
      <IconButton
        size="icon"
        className="sidebar-toggle"
        label={sidebarLabel}
        aria-expanded={sidebarOpen}
        aria-controls="editor-sidebar"
        onClick={onToggleSidebar}
      >
        {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
      </IconButton>
      <div className="version-tabs" role="tablist" aria-label="Versões do currículo">
        {versions.map((version, index) => (
          <VersionTab
            key={version.id}
            version={version}
            active={version.id === activeId}
            dirty={isDirty(version)}
            closeDisabled={closeDisabled}
            onSelect={() => onSelect(version.id)}
            onClose={() => onClose(version)}
            onKeyNavigate={(event) => navigate(event, index)}
          />
        ))}
        <Button variant="ghost" className="new-version-tab" onClick={onNew} disabled={newDisabled}>
          <Plus size={15} /> Nova Versão
        </Button>
      </div>
    </div>
  )
}

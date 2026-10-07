import { FileText, X } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import type { Version } from '@/lib/repository'

export const versionTabId = (id: string) => `version-tab-${id}`

export function VersionTab({
  version,
  active,
  dirty,
  closeDisabled,
  onSelect,
  onClose,
  onKeyNavigate,
}: {
  version: Version
  active: boolean
  dirty: boolean
  closeDisabled: boolean
  onSelect: () => void
  onClose: () => void
  onKeyNavigate: (event: KeyboardEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className={`version-tab ${active ? 'active' : ''}`}>
      <button
        type="button"
        role="tab"
        aria-label={version.name}
        aria-description={dirty ? 'Alterações em rascunho' : undefined}
        id={versionTabId(version.id)}
        aria-controls="resume-panel"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        className="version-tab-select"
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault()
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault()
            onClose()
          }
        }}
        title={version.name}
        onClick={(event) => {
          onSelect()
          if (event.detail === 3) onClose()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Delete') {
            event.preventDefault()
            onClose()
          } else onKeyNavigate(event)
        }}
      >
        <FileText size={15} />
        <span>{version.name}</span>
        {dirty && <span className="draft-indicator" title="Alterações em rascunho" />}
      </button>
      <button
        type="button"
        className="version-tab-close"
        aria-label={`Fechar e excluir ${version.name}`}
        title="Fechar significa excluir esta versão"
        disabled={closeDisabled}
        onClick={onClose}
      >
        <X size={14} />
      </button>
    </div>
  )
}

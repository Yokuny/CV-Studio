import { FileText, X } from 'lucide-react';
import type { Version } from '@/lib/repository';
import { selectCurrent, selectDeleting, selectIsDirty, useResumes } from '@/store/resumes';

export const versionTabId = (id: string) => `version-tab-${id}`;

const navigationKeys: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

export function VersionTab({ version, index }: { version: Version; index: number }) {
  const active = useResumes((s) => selectCurrent(s).id === version.id);
  const dirty = useResumes((s) => selectIsDirty(s, version));
  const closeDisabled = useResumes((s) => !s.ready || s.saving || selectDeleting(s));
  const select = useResumes((s) => s.select);
  const requestClose = useResumes((s) => s.requestClose);
  const close = () => requestClose(version);

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
          if (event.button === 1) event.preventDefault();
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
            close();
          }
        }}
        title={version.name}
        onClick={(event) => {
          select(version.id);
          if (event.detail === 3) close();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Delete') {
            event.preventDefault();
            close();
            return;
          }
          const { versions } = useResumes.getState();
          const target = navigationKeys[event.key]?.(index, versions.length);
          if (target === undefined) return;
          event.preventDefault();
          select(versions[target].id);
          document.getElementById(versionTabId(versions[target].id))?.focus();
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
        onClick={close}
      >
        <X size={14} />
      </button>
    </div>
  );
}

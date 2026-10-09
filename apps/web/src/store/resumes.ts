import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  alignBlocks,
  type BlockRange,
  defaultLayout,
  type Layout,
  remapBlockAlignments,
  slugify,
  starterMarkdown,
  type TextAlignment,
} from '@/lib/model';
import {
  deleteVersion,
  downloadSources,
  loadVersions,
  mergeDisk,
  RepositoryError,
  saveVersion,
  snapshot,
  type Version,
} from '@/lib/repository';
import { notify } from './notice';
import { type PersistedResumes, resumeStorage } from './persistence';

const emptyVersion: Version = {
  id: '',
  name: 'Novo currículo',
  markdown: starterMarkdown,
  layout: defaultLayout,
  revision: null,
};

export type VersionPatch = Partial<Version> | ((v: Version) => Partial<Version>);

interface ResumesState extends PersistedResumes {
  versions: Version[];
  activeId: string;
  /** Snapshot of each version as stored in content/cv, to detect drafts. */
  saved: Record<string, string>;
  writable: boolean;
  ready: boolean;
  saving: boolean;
  /** Version being deleted; its draft is dropped from storage while the request runs. */
  deletingId: string | null;
  /** Version awaiting confirmation in the close dialog. */
  closing: Version | null;
  /** Versions with unsaved edits whose files changed on disk; autosave pauses for them. */
  conflicts: string[];
  load: () => Promise<void>;
  /** Reads content/cv again after an external change, keeping unsaved edits. */
  refresh: () => Promise<void>;
  /** Discards the local edits of a version in favor of its file. */
  reloadFromDisk: (id: string) => Promise<void>;
  /** Writes a version, overwriting its file even after a conflict. */
  overwriteDisk: (id: string) => Promise<void>;
  select: (id: string) => void;
  update: (changes: VersionPatch) => void;
  updateLayout: (change: (layout: Layout) => Layout) => void;
  alignBlocks: (blocks: BlockRange[], align: TextAlignment) => void;
  save: () => Promise<void>;
  /** Writes one version to content/cv; quiet saves only report failures. */
  saveById: (id: string, quiet?: boolean) => Promise<void>;
  /** Copies the current version under a new name, writing its files in local mode; returns whether it was created. */
  create: (name: string) => Promise<boolean>;
  requestClose: (version: Version) => void;
  cancelClose: () => void;
  /** Deletes the version awaiting confirmation; throws on failure. */
  confirmClose: () => Promise<void>;
  importMarkdown: (file?: File) => Promise<void>;
  exportSources: () => void;
}

export const selectCurrent = (s: ResumesState) =>
  s.versions.find((v) => v.id === s.activeId) ?? s.versions[0] ?? emptyVersion;
export const selectHasVersion = (s: ResumesState) => s.versions.length > 0;
export const selectDeleting = (s: ResumesState) => s.deletingId !== null;
export const selectIsDirty = (s: ResumesState, v: Version) => s.saved[v.id] !== snapshot(v);
export const selectDirty = (s: ResumesState) => selectIsDirty(s, selectCurrent(s));
export const selectHasDrafts = (s: ResumesState) => s.versions.some((v) => selectIsDirty(s, v));

let loading: Promise<void> | undefined;
const autosaveDelay = 800;
const autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Map<string, Promise<void>>();

export const useResumes = create<ResumesState>()(
  persist(
    (set, get) => ({
      drafts: [],
      hidden: [],
      versions: [],
      activeId: 'base',
      saved: {},
      writable: false,
      ready: false,
      saving: false,
      deletingId: null,
      closing: null,
      conflicts: [],

      load: () => {
        loading ??= loadVersions().then(({ versions: disk, writable }) => {
          const hidden = writable ? [] : get().hidden;
          disk = disk.filter((v) => !hidden.includes(v.id));
          const drafts = get().drafts.filter((v) => !hidden.includes(v.id));
          const merged = disk.map((v) => drafts.find((d) => d.id === v.id) ?? v);
          merged.push(...drafts.filter((d) => !disk.some((v) => v.id === d.id)));
          set({
            versions: merged,
            activeId: merged.find((v) => v.id === 'base')?.id ?? merged[0]?.id ?? '',
            writable,
            saved: Object.fromEntries(disk.map((v) => [v.id, snapshot(v)])),
            ready: true,
          });
          // Drafts restored from the browser are written as soon as the files are writable.
          if (writable) for (const v of drafts) scheduleSave(v.id);
        });
        return loading;
      },
      refresh: async () => {
        if (!get().ready || !get().writable) return;
        await Promise.all(inflight.values());
        const { versions: disk, writable } = await loadVersions();
        if (!writable) return;
        set((s) => {
          const merged = mergeDisk(s.versions, s.saved, disk);
          const conflicts = [
            ...new Set([...s.conflicts.filter((id) => merged.conflicts.includes(id)), ...merged.conflicts]),
          ];
          return {
            versions: merged.versions,
            saved: merged.saved,
            conflicts,
            activeId: merged.versions.some((v) => v.id === s.activeId) ? s.activeId : (merged.versions[0]?.id ?? ''),
          };
        });
      },
      reloadFromDisk: async (id) => {
        clearTimeout(autosaveTimers.get(id));
        const { versions: disk } = await loadVersions();
        const stored = disk.find((v) => v.id === id);
        set((s) => {
          const { [id]: _removed, ...saved } = s.saved;
          const versions = stored
            ? s.versions.map((v) => (v.id === id ? stored : v))
            : s.versions.filter((v) => v.id !== id);
          return {
            versions,
            saved: stored ? { ...saved, [id]: snapshot(stored) } : saved,
            conflicts: s.conflicts.filter((c) => c !== id),
            activeId: versions.some((v) => v.id === s.activeId) ? s.activeId : (versions[0]?.id ?? ''),
          };
        });
        notify(
          stored
            ? `“${stored.name}” recarregada de content/cv.`
            : 'O arquivo foi removido do disco; a aba foi fechada.',
        );
      },
      overwriteDisk: async (id) => {
        const { versions: disk } = await loadVersions();
        const revision = disk.find((v) => v.id === id)?.revision ?? null;
        set((s) => ({
          versions: s.versions.map((v) => (v.id === id ? { ...v, revision } : v)),
          conflicts: s.conflicts.filter((c) => c !== id),
        }));
        await get().saveById(id);
      },
      select: (activeId) => set({ activeId }),
      update: (changes) => {
        const currentId = selectCurrent(get()).id;
        set((s) => ({
          versions: s.versions.map((v) => {
            if (v.id !== currentId) return v;
            const patch = typeof changes === 'function' ? changes(v) : changes;
            if (patch.markdown !== undefined && !patch.layout && v.layout.blockAlignments?.length) {
              patch.layout = {
                ...v.layout,
                blockAlignments: remapBlockAlignments(v.layout.blockAlignments, v.markdown, patch.markdown),
              };
            }
            return { ...v, ...patch };
          }),
        }));
        if (get().writable) scheduleSave(currentId);
      },
      updateLayout: (change) => get().update((v) => ({ layout: change(v.layout) })),
      alignBlocks: (blocks, align) =>
        get().update((v) => ({ layout: alignBlocks(v.layout, v.markdown, blocks, align) })),
      save: async () => {
        const { id } = selectCurrent(get());
        clearTimeout(autosaveTimers.get(id));
        await get().saveById(id);
      },
      saveById: async (id, quiet = false) => {
        await inflight.get(id);
        const version = get().versions.find((v) => v.id === id);
        if (!version || get().conflicts.includes(id) || (quiet && !selectIsDirty(get(), version))) return;
        const request = (async () => {
          set({ saving: true });
          try {
            const revision = await saveVersion(version);
            set((s) => ({
              versions: s.versions.map((v) => (v.id === id ? { ...v, revision } : v)),
              saved: { ...s.saved, [id]: snapshot({ ...version, revision }) },
            }));
            if (!quiet) notify(`“${version.name}” salva em content/cv.`);
          } catch (error) {
            if (error instanceof RepositoryError && error.status === 409)
              set((s) => ({ conflicts: [...new Set([...s.conflicts, id])] }));
            notify((error as Error).message);
          }
        })();
        inflight.set(id, request);
        try {
          await request;
        } finally {
          inflight.delete(id);
          set({ saving: inflight.size > 0 });
        }
        // Edits made while the request ran are saved next.
        const current = get().versions.find((v) => v.id === id);
        if (current && selectIsDirty(get(), current)) scheduleSave(id);
      },
      create: async (name) => {
        // The first resume of a fresh checkout becomes base.md, the source of facts the skill reads.
        const id = get().writable && !selectHasVersion(get()) ? 'base' : slugify(name);
        if (!id) {
          notify('Dê um nome à versão usando letras ou números.');
          return false;
        }
        if (get().versions.some((v) => v.id === id)) {
          notify('Já existe uma versão com esse nome. Escolha outro.');
          return false;
        }
        const version: Version = { ...selectCurrent(get()), id, name: name.trim().slice(0, 120), revision: null };
        if (get().writable) {
          try {
            version.revision = await saveVersion(version);
          } catch (error) {
            notify((error as Error).message);
            return false;
          }
        }
        set((s) => ({
          hidden: s.hidden.filter((hidden) => hidden !== id),
          // The file watcher may have opened the new file already.
          versions: [...s.versions.filter((v) => v.id !== id), version],
          saved: s.writable ? { ...s.saved, [id]: snapshot(version) } : s.saved,
          activeId: id,
        }));
        notify(
          get().writable
            ? `Versão criada em content/cv/${id}.md. As edições são salvas automaticamente.`
            : 'Versão criada como rascunho. Baixe os arquivos e coloque-os em content/cv para guardá-la.',
        );
        return true;
      },
      requestClose: (closing) => {
        const s = get();
        if (s.saving || s.deletingId !== null || !s.ready) return;
        set({ closing });
      },
      cancelClose: () => set({ closing: null }),
      confirmClose: async () => {
        const target = get().closing;
        if (!target) return;
        const { writable } = get();
        // Persisting without the draft first keeps Vite's reload from restoring it.
        set({ deletingId: target.id });
        clearTimeout(autosaveTimers.get(target.id));
        await inflight.get(target.id);
        try {
          if (writable) await deleteVersion(get().versions.find((v) => v.id === target.id) ?? target);
          set((s) => {
            const remaining = s.versions.filter((v) => v.id !== target.id);
            const index = s.versions.findIndex((v) => v.id === target.id);
            const { [target.id]: _removed, ...saved } = s.saved;
            return {
              versions: remaining,
              saved,
              conflicts: s.conflicts.filter((id) => id !== target.id),
              closing: null,
              activeId:
                selectCurrent(s).id === target.id
                  ? (remaining[Math.min(index, remaining.length - 1)]?.id ?? '')
                  : s.activeId,
              hidden: writable ? s.hidden : [...new Set([...s.hidden, target.id])],
            };
          });
          notify(
            `“${target.name}” excluída. ${writable ? 'Os arquivos foram removidos de content/cv.' : 'Os arquivos de content/cv permanecem intactos.'}`,
          );
        } finally {
          set({ deletingId: null });
        }
      },
      importMarkdown: async (file) => {
        if (!file) return;
        if (!/\.md$/i.test(file.name) || file.size > 250000) {
          notify('Escolha um arquivo .md de até 250 KB.');
          return;
        }
        try {
          get().update({ markdown: await file.text() });
          notify('Markdown importado como rascunho. Revise antes de salvar.');
        } catch {
          notify('Não foi possível ler o arquivo.');
        }
      },
      exportSources: () => {
        downloadSources(selectCurrent(get()));
        notify('Arquivos baixados. Coloque-os em content/cv para guardar esta versão.');
      },
    }),
    {
      name: 'cv-studio:resumes',
      storage: resumeStorage,
      partialize: (s): PersistedResumes => ({
        hidden: s.hidden,
        // Until versions load, keep what was restored instead of overwriting it.
        drafts: s.ready ? s.versions.filter((v) => v.id !== s.deletingId && selectIsDirty(s, v)) : s.drafts,
      }),
    },
  ),
);

function scheduleSave(id: string) {
  clearTimeout(autosaveTimers.get(id));
  autosaveTimers.set(
    id,
    setTimeout(() => {
      autosaveTimers.delete(id);
      void useResumes.getState().saveById(id, true);
    }, autosaveDelay),
  );
}

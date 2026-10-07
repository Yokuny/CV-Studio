import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  alignBlocks,
  type BlockRange,
  defaultLayout,
  type Layout,
  remapBlockAlignments,
  slugify,
  type TextAlignment,
} from '@/lib/model'
import {
  deleteVersion,
  downloadSources,
  loadVersions,
  saveVersion,
  snapshot,
  type Version,
} from '@/lib/repository'
import { notify } from './notice'
import { type PersistedResumes, resumeStorage } from './persistence'

const emptyVersion: Version = {
  id: '',
  name: 'Novo currículo',
  markdown: '# Seu nome\n\n',
  layout: defaultLayout,
  revision: null,
}

export type VersionPatch = Partial<Version> | ((v: Version) => Partial<Version>)

interface ResumesState extends PersistedResumes {
  versions: Version[]
  activeId: string
  /** Snapshot of each version as stored in content/cv, to detect drafts. */
  saved: Record<string, string>
  writable: boolean
  ready: boolean
  saving: boolean
  /** Version being deleted; its draft is dropped from storage while the request runs. */
  deletingId: string | null
  /** Version awaiting confirmation in the close dialog. */
  closing: Version | null
  load: () => Promise<void>
  select: (id: string) => void
  update: (changes: VersionPatch) => void
  updateLayout: (change: (layout: Layout) => Layout) => void
  alignBlocks: (blocks: BlockRange[], align: TextAlignment) => void
  save: () => Promise<void>
  /** Copies the current version under a new name; returns whether it was created. */
  create: (name: string) => boolean
  requestClose: (version: Version) => void
  cancelClose: () => void
  /** Deletes the version awaiting confirmation; throws on failure. */
  confirmClose: () => Promise<void>
  importMarkdown: (file?: File) => Promise<void>
  exportSources: () => void
}

export const selectCurrent = (s: ResumesState) =>
  s.versions.find((v) => v.id === s.activeId) ?? s.versions[0] ?? emptyVersion
export const selectHasVersion = (s: ResumesState) => s.versions.length > 0
export const selectDeleting = (s: ResumesState) => s.deletingId !== null
export const selectIsDirty = (s: ResumesState, v: Version) => s.saved[v.id] !== snapshot(v)
export const selectDirty = (s: ResumesState) => selectIsDirty(s, selectCurrent(s))
export const selectHasDrafts = (s: ResumesState) => s.versions.some((v) => selectIsDirty(s, v))

let loading: Promise<void> | undefined

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

      load: () => {
        loading ??= loadVersions().then(({ versions: disk, writable }) => {
          const hidden = writable ? [] : get().hidden
          disk = disk.filter((v) => !hidden.includes(v.id))
          const drafts = get().drafts.filter((v) => !hidden.includes(v.id))
          const merged = disk.map((v) => drafts.find((d) => d.id === v.id) ?? v)
          merged.push(...drafts.filter((d) => !disk.some((v) => v.id === d.id)))
          set({
            versions: merged,
            activeId: merged.find((v) => v.id === 'base')?.id ?? merged[0]?.id ?? '',
            writable,
            saved: Object.fromEntries(disk.map((v) => [v.id, snapshot(v)])),
            ready: true,
          })
        })
        return loading
      },
      select: (activeId) => set({ activeId }),
      update: (changes) => {
        const currentId = selectCurrent(get()).id
        set((s) => ({
          versions: s.versions.map((v) => {
            if (v.id !== currentId) return v
            const patch = typeof changes === 'function' ? changes(v) : changes
            if (patch.markdown !== undefined && !patch.layout && v.layout.blockAlignments?.length) {
              patch.layout = {
                ...v.layout,
                blockAlignments: remapBlockAlignments(
                  v.layout.blockAlignments,
                  v.markdown,
                  patch.markdown,
                ),
              }
            }
            return { ...v, ...patch }
          }),
        }))
      },
      updateLayout: (change) => get().update((v) => ({ layout: change(v.layout) })),
      alignBlocks: (blocks, align) =>
        get().update((v) => ({ layout: alignBlocks(v.layout, v.markdown, blocks, align) })),
      save: async () => {
        const version = selectCurrent(get())
        set({ saving: true })
        try {
          const revision = await saveVersion(version)
          set((s) => ({
            versions: s.versions.map((v) => (v.id === version.id ? { ...v, revision } : v)),
            saved: { ...s.saved, [version.id]: snapshot(version) },
          }))
          notify(`“${version.name}” salva em content/cv. Faça um commit para registrar no Git.`)
        } catch (error) {
          notify((error as Error).message)
        } finally {
          set({ saving: false })
        }
      },
      create: (name) => {
        const id = slugify(name)
        if (!id) {
          notify('Dê um nome à versão usando letras ou números.')
          return false
        }
        if (get().versions.some((v) => v.id === id)) {
          notify('Já existe uma versão com esse nome. Escolha outro.')
          return false
        }
        set((s) => ({
          hidden: s.hidden.filter((hidden) => hidden !== id),
          versions: [
            ...s.versions,
            { ...selectCurrent(s), id, name: name.trim().slice(0, 120), revision: null },
          ],
          activeId: id,
        }))
        notify('Versão criada como rascunho. Personalize e salve no repositório.')
        return true
      },
      requestClose: (closing) => {
        const s = get()
        if (s.saving || s.deletingId !== null || !s.ready) return
        set({ closing })
      },
      cancelClose: () => set({ closing: null }),
      confirmClose: async () => {
        const target = get().closing
        if (!target) return
        const { writable } = get()
        // Persisting without the draft first keeps Vite's reload from restoring it.
        set({ deletingId: target.id })
        try {
          if (writable) await deleteVersion(target)
          set((s) => {
            const remaining = s.versions.filter((v) => v.id !== target.id)
            const index = s.versions.findIndex((v) => v.id === target.id)
            const { [target.id]: _removed, ...saved } = s.saved
            return {
              versions: remaining,
              saved,
              closing: null,
              activeId:
                selectCurrent(s).id === target.id
                  ? (remaining[Math.min(index, remaining.length - 1)]?.id ?? '')
                  : s.activeId,
              hidden: writable ? s.hidden : [...new Set([...s.hidden, target.id])],
            }
          })
          notify(
            `“${target.name}” excluída. ${writable ? 'Faça um commit para registrar a exclusão no Git.' : 'Os arquivos do projeto permanecem no repositório.'}`,
          )
        } finally {
          set({ deletingId: null })
        }
      },
      importMarkdown: async (file) => {
        if (!file) return
        if (!/\.md$/i.test(file.name) || file.size > 250000) {
          notify('Escolha um arquivo .md de até 250 KB.')
          return
        }
        try {
          get().update({ markdown: await file.text() })
          notify('Markdown importado como rascunho. Revise antes de salvar.')
        } catch {
          notify('Não foi possível ler o arquivo.')
        }
      },
      exportSources: () => {
        downloadSources(selectCurrent(get()))
        notify('Arquivos baixados. Coloque-os em content/cv para incluir esta versão no Git.')
      },
    }),
    {
      name: 'cv-studio:resumes',
      storage: resumeStorage,
      partialize: (s): PersistedResumes => ({
        hidden: s.hidden,
        // Until versions load, keep what was restored instead of overwriting it.
        drafts: s.ready
          ? s.versions.filter((v) => v.id !== s.deletingId && selectIsDirty(s, v))
          : s.drafts,
      }),
    },
  ),
)

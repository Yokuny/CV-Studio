import { useEffect, useState } from 'react'
import {
  hiddenVersions,
  hideVersion,
  readDrafts,
  snapshot,
  unhideVersion,
  writeDrafts,
} from '@/lib/drafts'
import { defaultLayout, remapBlockAlignments, slugify } from '@/lib/model'
import {
  deleteVersion,
  downloadSources,
  loadVersions,
  saveVersion,
  type Version,
} from '@/lib/repository'

const emptyVersion: Version = {
  id: '',
  name: 'Novo currículo',
  markdown: '# Seu nome\n\n',
  layout: defaultLayout,
  revision: null,
}

export type VersionPatch = Partial<Version> | ((v: Version) => Partial<Version>)

export function useVersions(notify: (message: string) => void) {
  const [versions, setVersions] = useState<Version[]>([])
  const [activeId, setActiveId] = useState('base')
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [writable, setWritable] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const current = versions.find((v) => v.id === activeId) ?? versions[0] ?? emptyVersion
  const isDirty = (v: Version) => saved[v.id] !== snapshot(v)

  useEffect(() => {
    let cancelled = false
    loadVersions().then(({ versions: disk, writable }) => {
      if (cancelled) return
      const hidden = writable ? [] : hiddenVersions()
      disk = disk.filter((v) => !hidden.includes(v.id))
      const drafts = readDrafts().filter((v) => !hidden.includes(v.id))
      const merged = disk.map((v) => drafts.find((d) => d.id === v.id) ?? v)
      merged.push(...drafts.filter((d) => !disk.some((v) => v.id === d.id)))
      setVersions(merged)
      setActiveId(merged.find((v) => v.id === 'base')?.id ?? merged[0]?.id ?? '')
      setWritable(writable)
      setSaved(Object.fromEntries(disk.map((v) => [v.id, snapshot(v)])))
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    if (!ready) return
    try {
      writeDrafts(versions.filter((v) => saved[v.id] !== snapshot(v)))
    } catch {
      notify(
        'O navegador não conseguiu guardar o rascunho. Salve no repositório ou baixe o Markdown.',
      )
    }
  }, [versions, saved, ready, notify])
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (versions.some((v) => saved[v.id] !== snapshot(v))) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [versions, saved])

  function update(changes: VersionPatch) {
    setVersions((list) =>
      list.map((v) => {
        if (v.id !== current.id) return v
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
    )
  }
  async function save() {
    const version = current
    setSaving(true)
    try {
      const revision = await saveVersion(version)
      setVersions((list) => list.map((v) => (v.id === version.id ? { ...v, revision } : v)))
      setSaved((s) => ({ ...s, [version.id]: snapshot(version) }))
      notify(`“${version.name}” salva em content/cv. Faça um commit para registrar no Git.`)
    } catch (error) {
      notify((error as Error).message)
    } finally {
      setSaving(false)
    }
  }
  /** Copies the current version under a new name; returns whether it was created. */
  function create(name: string) {
    const id = slugify(name)
    if (!id) {
      notify('Dê um nome à versão usando letras ou números.')
      return false
    }
    if (versions.some((v) => v.id === id)) {
      notify('Já existe uma versão com esse nome. Escolha outro.')
      return false
    }
    unhideVersion(id)
    setVersions((list) => [
      ...list,
      { ...current, id, name: name.trim().slice(0, 120), revision: null },
    ])
    setActiveId(id)
    notify('Versão criada como rascunho. Personalize e salve no repositório.')
    return true
  }
  /** Deletes a version (files when writable, hidden otherwise); throws on failure. */
  async function remove(target: Version) {
    setDeleting(true)
    const drafts = readDrafts()
    try {
      // Remove the draft before filesystem changes can trigger Vite's reload.
      writeDrafts(drafts.filter((v) => v.id !== target.id))
      if (writable) await deleteVersion(target)
      else hideVersion(target.id)
      const remaining = versions.filter((v) => v.id !== target.id)
      if (current.id === target.id) {
        const index = versions.findIndex((v) => v.id === target.id)
        setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id ?? '')
      }
      setVersions(remaining)
      setSaved((previous) => {
        const next = { ...previous }
        delete next[target.id]
        return next
      })
      notify(
        `“${target.name}” excluída. ${writable ? 'Faça um commit para registrar a exclusão no Git.' : 'Os arquivos do projeto permanecem no repositório.'}`,
      )
    } catch (error) {
      writeDrafts(drafts)
      throw error
    } finally {
      setDeleting(false)
    }
  }
  async function importMarkdown(file?: File) {
    if (!file) return
    if (!/\.md$/i.test(file.name) || file.size > 250000) {
      notify('Escolha um arquivo .md de até 250 KB.')
      return
    }
    try {
      update({ markdown: await file.text() })
      notify('Markdown importado como rascunho. Revise antes de salvar.')
    } catch {
      notify('Não foi possível ler o arquivo.')
    }
  }
  function exportSources() {
    downloadSources(current)
    notify('Arquivos baixados. Coloque-os em content/cv para incluir esta versão no Git.')
  }

  return {
    versions,
    current,
    hasVersion: versions.length > 0,
    dirty: isDirty(current),
    isDirty,
    select: setActiveId,
    writable,
    ready,
    saving,
    deleting,
    update,
    save,
    create,
    remove,
    importMarkdown,
    exportSources,
  }
}

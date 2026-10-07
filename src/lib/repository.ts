import { type Resume, validResume } from './model'

export type Version = Resume & { revision: string | null }
/** Serializes a version without its revision, to compare against the stored copy. */
export function snapshot(v: Version) {
  const { revision: _revision, ...data } = v
  return JSON.stringify(data)
}
export async function loadVersions(): Promise<{ versions: Version[]; writable: boolean }> {
  try {
    const response = await fetch('/api/resumes')
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
      throw new Error('Static mode')
    const versions: Version[] = await response.json()
    if (!Array.isArray(versions) || !versions.every(validResume))
      throw new Error('Invalid repository')
    return {
      versions: versions.sort((a, b) =>
        a.id === 'base' ? -1 : b.id === 'base' ? 1 : a.name.localeCompare(b.name),
      ),
      writable: true,
    }
  } catch {
    const { bundledVersions } = await import('./bundled-resumes')
    return { versions: bundledVersions(), writable: false }
  }
}
export async function saveVersion(version: Version): Promise<string> {
  const { revision, ...resume } = version
  const response = await fetch('/api/resumes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume, expectedRevision: revision }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Não foi possível salvar.')
  return data.revision
}
export async function deleteVersion(version: Version): Promise<void> {
  const response = await fetch('/api/resumes', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: version.id, expectedRevision: version.revision }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Não foi possível excluir.')
}
export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function downloadSources(version: Version) {
  download(`${version.id}.md`, version.markdown, 'text/markdown;charset=utf-8')
  download(`${version.id}.layout.json`, JSON.stringify(version.layout, null, 2), 'application/json')
  download(
    `${version.id}.meta.json`,
    JSON.stringify({ name: version.name }, null, 2),
    'application/json',
  )
}

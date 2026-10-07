import { defaultLayout, type Resume, validLayout, validResume } from './model'

export type Version = Resume & { revision: string | null }
const markdowns = import.meta.glob('/content/cv/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>
const layouts = import.meta.glob('/content/cv/*.layout.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>
const metadata = import.meta.glob('/content/cv/*.meta.json', {
  eager: true,
  import: 'default',
}) as Record<string, { name: string; job: string }>

export function bundledVersions(): Version[] {
  return Object.entries(markdowns)
    .map(([path, markdown]) => {
      const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')
      const candidate = layouts[path.replace(/\.md$/, '.layout.json')]
      const meta = metadata[path.replace(/\.md$/, '.meta.json')]
      return {
        id,
        markdown,
        name: meta?.name ?? (id === 'base' ? 'Currículo base' : id),
        job: meta?.job ?? '',
        layout: validLayout(candidate) ? candidate : defaultLayout,
        revision: null,
      }
    })
    .sort((a, b) => (a.id === 'base' ? -1 : b.id === 'base' ? 1 : a.name.localeCompare(b.name)))
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
export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

import { defaultLayout, validLayout } from './model'
import type { Version } from './repository'

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
}) as Record<string, { name: string }>

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
        layout: validLayout(candidate) ? candidate : defaultLayout,
        revision: null,
      }
    })
    .sort((a, b) => (a.id === 'base' ? -1 : b.id === 'base' ? 1 : a.name.localeCompare(b.name)))
}

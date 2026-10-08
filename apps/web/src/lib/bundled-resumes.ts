import { defaultLayout, validLayout } from './model';
import type { Version } from './repository';

const markdowns = import.meta.glob('../../../../content/cv/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
const layouts = import.meta.glob('../../../../content/cv/*.layout.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;
const metadata = import.meta.glob('../../../../content/cv/*.meta.json', {
  eager: true,
  import: 'default',
}) as Record<string, { name: string }>;

const pitches = import.meta.glob('../../../../content/cv/*.pitch.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

/** The pitch file of a version in the static build; undefined when it has none. */
export function bundledPitch(id: string) {
  return Object.entries(pitches).find(([path]) => path.endsWith(`/${id}.pitch.md`))?.[1];
}

export function bundledVersions(): Version[] {
  return Object.entries(markdowns)
    .filter(([path]) => /\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(path))
    .map(([path, markdown]) => {
      const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
      const candidate = layouts[path.replace(/\.md$/, '.layout.json')];
      const meta = metadata[path.replace(/\.md$/, '.meta.json')];
      return {
        id,
        markdown,
        name: meta?.name ?? (id === 'base' ? 'Currículo base' : id),
        layout: validLayout(candidate) ? candidate : defaultLayout,
        revision: null,
      };
    })
    .sort((a, b) => (a.id === 'base' ? -1 : b.id === 'base' ? 1 : a.name.localeCompare(b.name)));
}

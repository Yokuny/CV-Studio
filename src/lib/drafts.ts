import { validResume } from './model'
import type { Version } from './repository'

const draftKey = 'cv-studio:drafts:v1'
const hiddenKey = 'cv-studio:hidden-versions:v1'

export function hiddenVersions(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(hiddenKey) ?? '[]')
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}
export function hideVersion(id: string) {
  localStorage.setItem(hiddenKey, JSON.stringify([...new Set([...hiddenVersions(), id])]))
}
export function unhideVersion(id: string) {
  localStorage.setItem(
    hiddenKey,
    JSON.stringify(hiddenVersions().filter((hidden) => hidden !== id)),
  )
}
export function readDrafts(): Version[] {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey) ?? '[]')
    return Array.isArray(value)
      ? (
          value.filter(
            (v) =>
              validResume(v) &&
              'revision' in v &&
              (v.revision === null || typeof v.revision === 'string'),
          ) as Version[]
        ).map(({ id, name, markdown, layout, revision }) => ({
          id,
          name,
          markdown,
          layout,
          revision,
        }))
      : []
  } catch {
    return []
  }
}
export function writeDrafts(drafts: Version[]) {
  localStorage.setItem(draftKey, JSON.stringify(drafts))
}
export function snapshot(v: Version) {
  const { revision: _revision, ...data } = v
  void _revision
  return JSON.stringify(data)
}

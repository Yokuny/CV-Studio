import type { PersistStorage } from 'zustand/middleware';
import { validResume } from '@/lib/model';
import type { Version } from '@/lib/repository';
import { notify } from './notice';

// Keys and raw formats predate the store; keep them so existing drafts survive.
const draftKey = 'cv-studio:drafts:v1';
const hiddenKey = 'cv-studio:hidden-versions:v1';

export interface PersistedResumes {
  /** Versions with changes not yet saved to content/cv. */
  drafts: Version[];
  /** Versions closed in static mode, where files cannot be removed. */
  hidden: string[];
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}
function parseHidden(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}
function parseDrafts(value: unknown): Version[] {
  if (!Array.isArray(value)) return [];
  return (
    value.filter(
      (v) => validResume(v) && 'revision' in v && (v.revision === null || typeof v.revision === 'string'),
    ) as Version[]
  ).map(({ id, name, markdown, layout, revision }) => ({ id, name, markdown, layout, revision }));
}

const written: Record<string, string> = {};
function write(key: string, value: unknown) {
  const text = JSON.stringify(value);
  if (written[key] === text) return;
  localStorage.setItem(key, text);
  written[key] = text;
}

/** Persists drafts and hidden versions in their own localStorage keys, as plain arrays. */
export const resumeStorage: PersistStorage<PersistedResumes> = {
  getItem: () => ({
    state: { drafts: parseDrafts(readJson(draftKey)), hidden: parseHidden(readJson(hiddenKey)) },
    version: 0,
  }),
  setItem: (_name, { state }) => {
    try {
      write(hiddenKey, state.hidden);
      write(draftKey, state.drafts);
    } catch {
      notify('O navegador não conseguiu guardar o rascunho. Salve em content/cv ou baixe o Markdown.');
    }
  },
  removeItem: () => {
    localStorage.removeItem(draftKey);
    localStorage.removeItem(hiddenKey);
  },
};

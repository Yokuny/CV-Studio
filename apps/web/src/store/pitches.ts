import { defaultPitch } from '@cv-studio/core/pitch';
import { create } from 'zustand';
import { api } from '@/lib/api';
import { RepositoryError } from '@/lib/repository';
import { notify } from './notice';
import { useResumes } from './resumes';

export interface Pitch {
  text: string;
  /** Revision of <id>.pitch.md; null while the version uses the base pitch. */
  revision: string | null;
  /** Text as last read from or written to disk, to detect unsaved edits. */
  saved: string;
  /** The base pitch, offered by "Restaurar do pitch base". */
  base: string;
}
interface PitchResponse {
  text: string;
  revision: string | null;
  base: string;
}

interface PitchesState {
  pitches: Record<string, Pitch>;
  /** Pitches with unsaved edits whose file changed on disk; autosave pauses for them. */
  conflicts: string[];
  saving: boolean;
  /** Loads the pitch of a version once; later reads come from refresh(). */
  load: (id: string) => Promise<void>;
  /** Reads loaded pitches again after an external change, keeping unsaved edits. */
  refresh: () => Promise<void>;
  update: (id: string, text: string) => void;
  saveById: (id: string, quiet?: boolean) => Promise<void>;
  reloadFromDisk: (id: string) => Promise<void>;
  overwriteDisk: (id: string) => Promise<void>;
  /** Gives a new version the pitch of the version it was copied from. */
  copy: (from: string, to: string) => Promise<void>;
}

export const selectIsPitchDirty = (p: Pitch | undefined) => p !== undefined && p.text !== p.saved;

const autosaveDelay = 800;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Map<string, Promise<void>>();
const writable = () => useResumes.getState().writable;

async function fetchPitch(id: string): Promise<PitchResponse> {
  if (!writable()) {
    const { bundledPitch } = await import('@/lib/bundled-resumes');
    const base = bundledPitch('base') ?? defaultPitch;
    const own = bundledPitch(id);
    return { text: own ?? base, revision: null, base };
  }
  return api<PitchResponse>(`pitches/${id}`);
}
const entry = ({ text, revision, base }: PitchResponse): Pitch => ({ text, revision, saved: text, base });

export const usePitches = create<PitchesState>()((set, get) => ({
  pitches: {},
  conflicts: [],
  saving: false,

  load: async (id) => {
    if (!id || get().pitches[id]) return;
    try {
      const pitch = await fetchPitch(id);
      set((s) => (s.pitches[id] ? s : { pitches: { ...s.pitches, [id]: entry(pitch) } }));
    } catch (error) {
      notify((error as Error).message);
    }
  },
  refresh: async () => {
    if (!writable()) return;
    await Promise.all(inflight.values());
    const ids = Object.keys(get().pitches);
    const disk = await Promise.all(ids.map((id) => fetchPitch(id).catch(() => undefined)));
    set((s) => {
      const pitches = { ...s.pitches };
      const conflicts = new Set(s.conflicts);
      ids.forEach((id, i) => {
        const stored = disk[i];
        const local = pitches[id];
        if (!stored || !local) return;
        if (stored.revision === local.revision && stored.base === local.base) return;
        // Clean pitches follow the disk; edited ones keep the edits and pause until resolved.
        if (!selectIsPitchDirty(local) || stored.text === local.text) pitches[id] = entry(stored);
        else if (stored.revision !== local.revision) conflicts.add(id);
        else pitches[id] = { ...local, base: stored.base };
      });
      return { pitches, conflicts: [...conflicts] };
    });
  },
  update: (id, text) => {
    const current = get().pitches[id];
    if (!current) return;
    set((s) => ({ pitches: { ...s.pitches, [id]: { ...current, text } } }));
    if (!writable()) return;
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        void get().saveById(id, true);
      }, autosaveDelay),
    );
  },
  saveById: async (id, quiet = false) => {
    clearTimeout(timers.get(id));
    await inflight.get(id);
    const pitch = get().pitches[id];
    if (!pitch || !writable() || get().conflicts.includes(id) || !selectIsPitchDirty(pitch)) return;
    const request = (async () => {
      set({ saving: true });
      try {
        const { revision, pruned } = await api<{ revision: string; pruned: string[] }>(`pitches/${id}`, {
          method: 'PUT',
          body: { text: pitch.text, expectedRevision: pitch.revision },
        });
        set((s) => {
          const pitches = { ...s.pitches, [id]: { ...(s.pitches[id] ?? pitch), revision, saved: pitch.text } };
          // Pruned versions fall back to the base pitch, which the next load reads again.
          for (const removed of pruned) delete pitches[removed];
          return { pitches };
        });
        if (pruned.length)
          notify(`Limite de 20 pitches: removido o pitch de ${pruned.join(', ')}, que volta a usar o pitch base.`);
        else if (!quiet) notify('Pitch salvo em content/cv.');
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
    if (selectIsPitchDirty(get().pitches[id])) get().update(id, get().pitches[id].text);
  },
  reloadFromDisk: async (id) => {
    clearTimeout(timers.get(id));
    const pitch = await fetchPitch(id);
    set((s) => ({ pitches: { ...s.pitches, [id]: entry(pitch) }, conflicts: s.conflicts.filter((c) => c !== id) }));
    notify('Pitch recarregado de content/cv.');
  },
  overwriteDisk: async (id) => {
    const { revision } = await fetchPitch(id);
    set((s) => ({
      pitches: { ...s.pitches, [id]: { ...s.pitches[id], revision } },
      conflicts: s.conflicts.filter((c) => c !== id),
    }));
    await get().saveById(id);
  },
  copy: async (from, to) => {
    await get().load(from);
    const source = get().pitches[from];
    // A version that still uses the base pitch passes that on by having no file of its own.
    if (!source || (source.revision === null && !selectIsPitchDirty(source))) return;
    set((s) => ({ pitches: { ...s.pitches, [to]: { ...source, revision: null, saved: source.base } } }));
    await get().saveById(to, true);
  },
}));

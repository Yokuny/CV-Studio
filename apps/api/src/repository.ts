import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { defaultLayout, type Resume, validLayout, validResume } from '@cv-studio/core/model';
import { defaultPitch, pitchLimit } from '@cv-studio/core/pitch';

export const companions = ['md', 'layout.json', 'meta.json'] as const;
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Each version may have its email pitch beside it; base.pitch.md is the base pitch. */
export const pitchExt = 'pitch.md';

export function revision(resume: Resume) {
  const { id, markdown, layout, name } = resume;
  return createHash('sha256').update(JSON.stringify({ id, markdown, layout, name })).digest('hex');
}
/** Revision of a pitch file; null when the version still uses the base pitch. */
export function pitchRevision(text: string | undefined) {
  return text === undefined ? null : createHash('sha256').update(text).digest('hex');
}
export function defaultName(id: string) {
  return id === 'base' ? 'Currículo base' : id;
}
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT';

/** Reads and writes the version files in content/cv, shared by the Vite API and the `pnpm cv` CLI. */
export function resumeFiles(root: string) {
  const legacyRevisions = new Map<string, string>();
  const readSafe = async (filename: string) => {
    const target = path.join(root, filename);
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Arquivo inválido.');
    return fs.readFile(target, 'utf8');
  };
  const writeAtomic = async (filename: string, data: string) => {
    const target = path.join(root, filename);
    try {
      if ((await fs.lstat(target)).isSymbolicLink()) throw new Error('Arquivo inválido.');
    } catch (e) {
      if (!missing(e)) throw e;
    }
    const temporary = `${target}.${createHash('sha256').update(String(Math.random())).digest('hex').slice(0, 12)}.tmp`;
    try {
      await fs.writeFile(temporary, data, { flag: 'wx' });
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  };
  const load = async (id: string): Promise<Resume> => {
    const markdown = await readSafe(`${id}.md`);
    let layout = defaultLayout;
    let meta = { name: defaultName(id), job: '' };
    try {
      const candidate = JSON.parse(await readSafe(`${id}.layout.json`));
      if (validLayout(candidate)) layout = candidate;
    } catch (e) {
      if (!missing(e)) throw e;
    }
    try {
      meta = JSON.parse(await readSafe(`${id}.meta.json`));
    } catch (e) {
      if (!missing(e)) throw e;
    }
    // Old drafts can still save safely after the job field is retired.
    legacyRevisions.set(
      id,
      createHash('sha256')
        .update(JSON.stringify({ id, markdown, layout, ...meta }))
        .digest('hex'),
    );
    const resume = { id, markdown, layout, name: meta.name };
    if (!validResume(resume)) throw new Error('Versão inválida no repositório.');
    return resume;
  };
  return {
    root,
    /** Rejects a content/cv that is itself a symlink or escapes the project. */
    async verifyRoot() {
      return (await fs.realpath(root)) === root;
    },
    async ids() {
      return (await fs.readdir(root))
        .filter((f) => f.endsWith('.md') && slugPattern.test(f.slice(0, -3)))
        .map((f) => f.slice(0, -3));
    },
    load,
    /** Loads a version if it exists; undefined when its Markdown is missing. */
    async find(id: string) {
      try {
        return await load(id);
      } catch (e) {
        if (!missing(e)) throw e;
      }
    },
    matches(current: Resume | undefined, expectedRevision: string | null) {
      return (
        (current ? revision(current) : null) === expectedRevision ||
        (current !== undefined && legacyRevisions.get(current.id) === expectedRevision)
      );
    },
    async write(resume: Resume) {
      await writeAtomic(`${resume.id}.md`, resume.markdown);
      await writeAtomic(`${resume.id}.layout.json`, `${JSON.stringify(resume.layout, null, 2)}\n`);
      await writeAtomic(`${resume.id}.meta.json`, `${JSON.stringify({ name: resume.name }, null, 2)}\n`);
      return revision(resume);
    },
    /** Copies a version's Markdown and layout under a new slug, like + Nova Versão. */
    async copy(from: string, id: string, name: string) {
      const resume = { ...(await load(from)), id, name: name.trim() };
      if (!validResume(resume))
        throw new Error('Use um slug em minúsculas com hífens e um nome de 1 a 120 caracteres.');
      for (const ext of companions) {
        const exists = await fs.lstat(path.join(root, `${id}.${ext}`)).then(
          () => true,
          (e) => (missing(e) ? false : Promise.reject(e)),
        );
        if (exists) throw new Error(`Já existe content/cv/${id}.${ext}; edite essa versão ou escolha outro slug.`);
      }
      await this.write(resume);
      const pruned = await this.writePitch(id, await this.effectivePitch(from));
      return { ...resume, pruned };
    },
    async remove(id: string) {
      const targets = [...companions, pitchExt].map((ext) => path.join(root, `${id}.${ext}`));
      // Inspect every companion file before removing any of them.
      for (const target of targets) {
        try {
          const stat = await fs.lstat(target);
          if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Arquivo inválido.');
        } catch (e) {
          if (!missing(e)) throw e;
        }
      }
      for (const target of targets) await fs.rm(target, { force: true });
    },
    /** The pitch file of a version; undefined when it has none. */
    async readPitch(id: string) {
      try {
        return await readSafe(`${id}.${pitchExt}`);
      } catch (e) {
        if (!missing(e)) throw e;
      }
    },
    /** The pitch a version sends: its own file, else base.pitch.md, else the starter template. */
    async effectivePitch(id: string) {
      return (await this.readPitch(id)) ?? (await this.readPitch('base')) ?? defaultPitch;
    },
    /** Writes a version pitch and prunes the oldest ones; returns the ids whose pitch was removed. */
    async writePitch(id: string, text: string) {
      await writeAtomic(`${id}.${pitchExt}`, text);
      return id === 'base' ? [] : this.prunePitches(pitchLimit, id);
    },
    /** Keeps base.pitch.md and the `limit` most recently modified version pitches. */
    async prunePitches(limit = pitchLimit, keep?: string) {
      const pitches = await Promise.all(
        (await fs.readdir(root))
          .filter((f) => f.endsWith(`.${pitchExt}`))
          .map((f) => f.slice(0, -pitchExt.length - 1))
          .filter((id) => id !== 'base' && slugPattern.test(id))
          .map(async (id) => {
            const stat = await fs.lstat(path.join(root, `${id}.${pitchExt}`));
            return { id, mtime: stat.mtimeMs, file: stat.isFile() && !stat.isSymbolicLink() };
          }),
      );
      const removed = pitches
        .filter((p) => p.file)
        .sort((a, b) => (a.id === keep ? -1 : b.id === keep ? 1 : b.mtime - a.mtime || a.id.localeCompare(b.id)))
        .slice(limit)
        .map((p) => p.id);
      for (const id of removed) await fs.rm(path.join(root, `${id}.${pitchExt}`), { force: true });
      return removed;
    },
  };
}
export type ResumeFiles = ReturnType<typeof resumeFiles>;

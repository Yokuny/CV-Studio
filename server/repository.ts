import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { defaultLayout, type Resume, validLayout, validResume } from '../src/lib/model';

export const companions = ['md', 'layout.json', 'meta.json'] as const;
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function revision(resume: Resume) {
  const { id, markdown, layout, name } = resume;
  return createHash('sha256').update(JSON.stringify({ id, markdown, layout, name })).digest('hex');
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
      return resume;
    },
    async remove(id: string) {
      const targets = companions.map((ext) => path.join(root, `${id}.${ext}`));
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
  };
}
export type ResumeFiles = ReturnType<typeof resumeFiles>;

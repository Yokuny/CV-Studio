import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defaultLayout, type Resume, validLayout, validResume } from '../src/lib/model';

export function revision(resume: Resume) {
  const { id, markdown, layout, name } = resume;
  return createHash('sha256').update(JSON.stringify({ id, markdown, layout, name })).digest('hex');
}
export function resumeApi(): Plugin {
  let root: string;
  let queue = Promise.resolve();
  return {
    name: 'local-resume-api',
    configResolved(config) {
      root = path.join(config.root, 'content/cv');
    },
    configureServer(server) {
      server.middlewares.use('/api/resumes', async (req, res) => {
        const reply = (status: number, data: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(data));
        };
        // The write endpoint is only for the local development UI, never a hosted API.
        const host = req.headers.host ?? '';
        const origin = req.headers.origin;
        if (
          !/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host) ||
          (origin && ![`http://${host}`, `https://${host}`].includes(origin))
        ) {
          reply(403, { error: 'A gravação só é permitida pela interface local.' });
          return;
        }
        const readSafe = async (filename: string) => {
          const target = path.join(root, filename);
          const stat = await fs.lstat(target);
          if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Arquivo inválido.');
          return fs.readFile(target, 'utf8');
        };
        const legacyRevisions = new Map<string, string>();
        const load = async (id: string): Promise<Resume> => {
          const markdown = await readSafe(`${id}.md`);
          let layout = defaultLayout;
          let meta = { name: id === 'base' ? 'Currículo base' : id, job: '' };
          try {
            const candidate = JSON.parse(await readSafe(`${id}.layout.json`));
            if (validLayout(candidate)) layout = candidate;
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
          }
          try {
            meta = JSON.parse(await readSafe(`${id}.meta.json`));
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
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
        try {
          if ((await fs.realpath(root)) !== root) {
            reply(403, { error: 'Diretório de currículos inválido.' });
            return;
          }
          if (req.method === 'GET') {
            await queue;
            const ids = (await fs.readdir(root))
              .filter((f) => /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(f))
              .map((f) => f.slice(0, -3));
            const resumes = await Promise.all(
              ids.map(async (id) => {
                const r = await load(id);
                return { ...r, revision: revision(r) };
              }),
            );
            reply(200, resumes);
            return;
          }
          if (req.method !== 'POST' && req.method !== 'DELETE') {
            reply(405, { error: 'Método não permitido.' });
            return;
          }
          if (!req.headers['content-type']?.startsWith('application/json')) {
            reply(415, { error: 'Envie JSON.' });
            return;
          }
          let body = '';
          for await (const chunk of req) {
            body += chunk.toString();
            if (Buffer.byteLength(body) > 1200000) {
              reply(413, { error: 'Arquivo muito grande.' });
              return;
            }
          }
          const { resume, id, expectedRevision } = JSON.parse(body);
          const deleting = req.method === 'DELETE';
          if (
            (deleting ? typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) : !validResume(resume)) ||
            !(expectedRevision === null || typeof expectedRevision === 'string')
          ) {
            reply(400, { error: 'Conteúdo ou tokens inválidos.' });
            return;
          }
          // Serializing saves makes the conflict check meaningful even for simultaneous tabs.
          const save = queue.then(async () => {
            const targetId = deleting ? id : resume.id;
            let current: Resume | undefined;
            try {
              current = await load(targetId);
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
            }
            if (
              (current ? revision(current) : null) !== expectedRevision &&
              !(current && legacyRevisions.get(targetId) === expectedRevision)
            ) {
              reply(409, {
                error:
                  'Esta versão mudou no disco. Baixe seu Markdown antes de recarregar para comparar as alterações.',
              });
              return;
            }
            if (deleting) {
              const targets = ['md', 'layout.json', 'meta.json'].map((ext) => path.join(root, `${targetId}.${ext}`));
              // Inspect every companion file before removing any of them.
              for (const target of targets) {
                try {
                  const stat = await fs.lstat(target);
                  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Arquivo inválido.');
                } catch (e) {
                  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
                }
              }
              for (const target of targets) await fs.rm(target, { force: true });
              reply(200, { deleted: targetId });
              return;
            }
            const files = [
              [`${resume.id}.md`, resume.markdown],
              [`${resume.id}.layout.json`, `${JSON.stringify(resume.layout, null, 2)}\n`],
              [`${resume.id}.meta.json`, `${JSON.stringify({ name: resume.name }, null, 2)}\n`],
            ];
            for (const [filename, data] of files) {
              const target = path.join(root, filename);
              try {
                if ((await fs.lstat(target)).isSymbolicLink()) throw new Error('Arquivo inválido.');
              } catch (e) {
                if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
              }
              const temporary = `${target}.${createHash('sha256').update(String(Math.random())).digest('hex').slice(0, 12)}.tmp`;
              try {
                await fs.writeFile(temporary, data, { flag: 'wx' });
                await fs.rename(temporary, target);
              } finally {
                await fs.rm(temporary, { force: true });
              }
            }
            reply(200, { revision: revision(resume) });
          });
          queue = save.catch(() => {});
          await save;
        } catch (e) {
          console.error('[resume-api]', e);
          reply(400, {
            error: 'Não foi possível ler ou salvar a versão. Verifique os arquivos em content/cv.',
          });
        }
      });
    },
  };
}

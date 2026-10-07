import path from 'node:path';
import type { Plugin } from 'vite';
import { validResume } from '../src/lib/model';
import { companions, type ResumeFiles, resumeFiles, revision, slugPattern } from './repository';

export { revision } from './repository';
/** Custom HMR event sent when files in content/cv change, by the UI, the CLI or an agent. */
export const changedEvent = 'cv-studio:changed';

export function resumeApi(): Plugin {
  let files: ResumeFiles;
  let queue = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    name: 'local-resume-api',
    configResolved(config) {
      files = resumeFiles(path.join(config.root, 'content/cv'));
    },
    // Files in content/cv are part of the module graph through the bundled-resumes glob. Instead of
    // letting Vite reload the page, which would drop the open tab, the UI merges them via changedEvent.
    hotUpdate({ file }) {
      if (path.dirname(file) !== files.root) return;
      const name = path.basename(file);
      if (!companions.some((ext) => name.endsWith(`.${ext}`))) return;
      if (this.environment.name === 'client') {
        // A save touches three files; one event lets the UI reload them together.
        clearTimeout(timer);
        const { hot } = this.environment;
        timer = setTimeout(() => hot.send({ type: 'custom', event: changedEvent }), 150);
      }
      return [];
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
        try {
          if (!(await files.verifyRoot())) {
            reply(403, { error: 'Diretório de currículos inválido.' });
            return;
          }
          if (req.method === 'GET') {
            await queue;
            const resumes = await Promise.all(
              (await files.ids()).map(async (id) => {
                const r = await files.load(id);
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
            (deleting ? typeof id !== 'string' || !slugPattern.test(id) : !validResume(resume)) ||
            !(expectedRevision === null || typeof expectedRevision === 'string')
          ) {
            reply(400, { error: 'Conteúdo ou tokens inválidos.' });
            return;
          }
          // Serializing saves makes the conflict check meaningful even for simultaneous tabs.
          const save = queue.then(async () => {
            const targetId = deleting ? id : resume.id;
            if (!files.matches(await files.find(targetId), expectedRevision)) {
              reply(409, {
                error: 'Esta versão mudou no disco. Recarregue do arquivo ou baixe seu Markdown para comparar.',
              });
              return;
            }
            if (deleting) {
              await files.remove(targetId);
              reply(200, { deleted: targetId });
              return;
            }
            reply(200, { revision: await files.write(resume) });
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

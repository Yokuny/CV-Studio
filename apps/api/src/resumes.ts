import { validResume } from '@cv-studio/core/model';
import { type Request, type Response, Router } from 'express';
import { type ResumeFiles, revision, slugPattern } from './repository';

export { revision } from './repository';

/** Reads and writes the resume versions in content/cv for the local UI. */
export function resumesRouter(files: ResumeFiles, serialize: <T>(task: () => Promise<T>) => Promise<T>) {
  const router = Router();
  router.use(async (_req, res, next) => {
    if (await files.verifyRoot()) return next();
    res.status(403).json({ error: 'Diretório de currículos inválido.' });
  });
  router.get('/', async (_req, res) => {
    const resumes = await serialize(async () =>
      Promise.all(
        (await files.ids()).map(async (id) => {
          const r = await files.load(id);
          return { ...r, revision: revision(r) };
        }),
      ),
    );
    res.json(resumes);
  });
  const change = (deleting: boolean) => async (req: Request, res: Response) => {
    const { resume, id, expectedRevision } = req.body ?? {};
    if (
      (deleting ? typeof id !== 'string' || !slugPattern.test(id) : !validResume(resume)) ||
      !(expectedRevision === null || typeof expectedRevision === 'string')
    ) {
      res.status(400).json({ error: 'Conteúdo ou tokens inválidos.' });
      return;
    }
    // Serializing saves makes the conflict check meaningful even for simultaneous tabs.
    await serialize(async () => {
      const targetId = deleting ? id : resume.id;
      if (!files.matches(await files.find(targetId), expectedRevision)) {
        res.status(409).json({
          error: 'Esta versão mudou no disco. Recarregue do arquivo ou baixe seu Markdown para comparar.',
        });
        return;
      }
      if (deleting) {
        await files.remove(targetId);
        res.json({ deleted: targetId });
        return;
      }
      res.json({ revision: await files.write(resume) });
    });
  };
  router.post('/', change(false));
  router.delete('/', change(true));
  return router;
}

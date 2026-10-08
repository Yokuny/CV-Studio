import { defaultPitch, validPitch } from '@cv-studio/core/pitch';
import { Router } from 'express';
import { pitchRevision, type ResumeFiles, slugPattern } from './repository';

/** Reads and writes <slug>.pitch.md, the email pitch of each version. */
export function pitchesRouter(files: ResumeFiles, serialize: <T>(task: () => Promise<T>) => Promise<T>) {
  const router = Router();
  router.param('id', (_req, res, next, id) => {
    if (slugPattern.test(id)) return next();
    res.status(400).json({ error: 'Versão inválida.' });
  });
  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const [own, base] = await serialize(() => Promise.all([files.readPitch(id), files.readPitch('base')]));
    // Without its own file, a version starts from the base pitch.
    res.json({ id, text: own ?? base ?? defaultPitch, revision: pitchRevision(own), base: base ?? defaultPitch });
  });
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { text, expectedRevision } = req.body ?? {};
    if (!validPitch(text) || !(expectedRevision === null || typeof expectedRevision === 'string')) {
      res.status(400).json({ error: 'Pitch inválido.' });
      return;
    }
    await serialize(async () => {
      if (id !== 'base' && !(await files.find(id))) {
        res.status(404).json({ error: 'Versão não encontrada em content/cv.' });
        return;
      }
      if (pitchRevision(await files.readPitch(id)) !== expectedRevision) {
        res.status(409).json({ error: 'O pitch mudou no disco. Recarregue do arquivo para comparar.' });
        return;
      }
      const pruned = await files.writePitch(id, text);
      res.json({ revision: pitchRevision(text), pruned });
    });
  });
  return router;
}

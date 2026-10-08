import { parseMailAccount, parseOutlookConnect } from '@cv-studio/core/mail';
import express, { type ErrorRequestHandler } from 'express';
import { openDatabase } from './db';
import { contentEvents } from './events';
import { jobsRouter } from './jobs';
import { type MailOptions, mailAccount, mailError } from './mail';
import { closePdfBrowser, renderPdf } from './pdf';
import { pitchesRouter } from './pitches';
import { resumeFiles } from './repository';
import { resumesRouter } from './resumes';
import { jsonOnly, localOnly } from './security';

const outlookSetupError =
  'Configure CV_STUDIO_OUTLOOK_CLIENT_ID em .env.local, na raiz do projeto, e reinicie a API (docs/email-outlook.md).';

export interface ApiOptions {
  contentRoot: string;
  dataRoot: string;
  /** Origin of the studio UI, opened by Chromium to print the PDF attachment. */
  webOrigin: string;
  /** Replaces the Chromium printer, for tests. */
  renderPdf?: (id: string) => Promise<Buffer>;
  mailOptions?: MailOptions;
  outlookClientId?: string;
}

/** The local API of CV Studio: resume files, pitches, jobs and email. Never meant to be hosted. */
export function createApi({ contentRoot, dataRoot, webOrigin, ...options }: ApiOptions) {
  const files = resumeFiles(contentRoot);
  const db = openDatabase(dataRoot);
  const mail = mailAccount(dataRoot, options.mailOptions);
  const outlookClientId = options.outlookClientId ?? process.env.CV_STUDIO_OUTLOOK_CLIENT_ID;
  const outlookConfigured = () =>
    typeof parseOutlookConnect({ user: 'config@example.com', clientId: outlookClientId }) !== 'string';
  const events = contentEvents(contentRoot);
  // File writes run one at a time, so conflict checks see the result of the previous save.
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(task: () => Promise<T>) => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };

  const app = express();
  app.disable('x-powered-by');
  app.use('/api', localOnly, jsonOnly, express.json({ limit: '1200kb' }));
  app.get('/api/events', (_req, res) => events.subscribe(res));
  app.use('/api/resumes', resumesRouter(files, serialize));
  app.use('/api/pitches', pitchesRouter(files, serialize));
  app.use(
    '/api/jobs',
    jobsRouter({ db, files, mail, renderPdf: options.renderPdf ?? ((id) => renderPdf(webOrigin, id)) }),
  );
  app.get('/api/mail/account', async (_req, res) => {
    res.json(await mail.view());
  });
  app.post('/api/mail/outlook/start', async (req, res) => {
    // The client ID comes only from CV_STUDIO_OUTLOOK_CLIENT_ID (.env.local), never from the browser.
    if (!outlookConfigured()) {
      res.status(400).json({ error: outlookSetupError });
      return;
    }
    const input = parseOutlookConnect({ ...req.body, clientId: outlookClientId });
    if (typeof input === 'string') {
      res.status(400).json({ error: input });
      return;
    }
    try {
      res.json(await mail.startOutlook(input));
    } catch (e) {
      res.status(502).json({ error: mailError(e, 'outlook') });
    }
  });
  app.get('/api/mail/outlook/config', (_req, res) => {
    res.json({
      configured: outlookConfigured(),
    });
  });
  app.post('/api/mail/outlook/poll', async (req, res) => {
    if (typeof req.body?.sessionId !== 'string') {
      res.status(400).json({ error: 'Sessão Microsoft inválida.' });
      return;
    }
    try {
      res.json(await mail.pollOutlook(req.body.sessionId));
    } catch (e) {
      res.status(502).json({ error: mailError(e, 'outlook') });
    }
  });
  app.post('/api/mail/outlook/cancel', async (req, res) => {
    if (typeof req.body?.sessionId !== 'string') {
      res.status(400).json({ error: 'Sessão Microsoft inválida.' });
      return;
    }
    await mail.cancelOutlook(req.body.sessionId);
    res.json({ ok: true });
  });
  app.put('/api/mail/account', async (req, res) => {
    const input = parseMailAccount(req.body);
    if (typeof input === 'string') {
      res.status(400).json({ error: input });
      return;
    }
    res.json(await mail.save(input));
  });
  app.post('/api/mail/connect', async (req, res) => {
    const input = parseMailAccount(req.body);
    if (typeof input === 'string') {
      res.status(400).json({ error: input });
      return;
    }
    try {
      res.json(await mail.connect(input));
    } catch (e) {
      res.status(502).json({ error: mailError(e, input.provider) });
    }
  });
  app.delete('/api/mail/account', async (_req, res) => {
    await mail.remove();
    res.json(null);
  });
  app.post('/api/mail/verify', async (_req, res) => {
    try {
      await mail.verify();
      res.json({ ok: true });
    } catch (e) {
      res.status(502).json({ error: mailError(e, (await mail.view())?.provider) });
    }
  });
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Arquivo muito grande.' });
      return;
    }
    if (error?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'JSON inválido.' });
      return;
    }
    console.error('[cv-studio-api]', error);
    res.status(400).json({ error: 'Não foi possível ler ou salvar. Verifique os arquivos em content/cv e data/.' });
  };
  app.use(onError);

  return {
    app,
    async close() {
      events.close();
      db.close();
      await closePdfBrowser();
    },
  };
}

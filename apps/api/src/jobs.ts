import { type Job, jobCsvColumns, parseJob } from '@cv-studio/core/jobs';
import { pitchTodo, renderTemplate, resumeName } from '@cv-studio/core/pitch';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { Router } from 'express';
import type { Database } from './db';
import { type MailAccount, mailError } from './mail';
import type { ResumeFiles } from './repository';

export interface JobsDeps {
  db: Database;
  files: ResumeFiles;
  mail: MailAccount;
  renderPdf: (id: string) => Promise<Buffer>;
}

/** Today's date (YYYY-MM-DD) in the local time zone, like the date input of the UI. */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fills subject and pitch for a job; `problems` lists what blocks sending. */
async function compose({ files }: JobsDeps, job: Job) {
  const resume = await files.find(job.resumeId);
  const problems: string[] = [];
  if (!resume) problems.push(`A versão "${job.resumeId}" não existe mais em content/cv.`);
  if (!job.recruiterEmail) problems.push('Cadastre o email de quem recruta.');
  const pitch = await files.effectivePitch(job.resumeId);
  const nome = resume ? resumeName(resume.markdown) : '';
  const values = { empresa: job.company, cargo: job.role, recrutadora: job.recruiterName, nome };
  const subject = renderTemplate(job.subject, values);
  const body = renderTemplate(pitch, values);
  const unresolved = [...new Set([...subject.missing, ...body.missing])];
  const unknown = [...new Set([...subject.unknown, ...body.unknown])];
  if (unresolved.length) problems.push(`Preencha na vaga: ${unresolved.map((v) => `{{${v}}}`).join(', ')}.`);
  if (unknown.length) problems.push(`Variáveis desconhecidas no pitch: ${unknown.map((v) => `{{${v}}}`).join(', ')}.`);
  if (body.text.includes(pitchTodo)) problems.push('O pitch ainda tem o trecho de exemplo "[Escreva aqui…]".');
  if (!body.text.trim()) problems.push('O pitch está vazio.');
  return {
    to: job.recruiterEmail,
    toName: job.recruiterName,
    subject: subject.text,
    body: body.text,
    attachment: `Currículo - ${nome || job.resumeId}.pdf`,
    usesBasePitch: (await files.readPitch(job.resumeId)) === undefined,
    problems,
  };
}

export function jobsRouter(deps: JobsDeps) {
  const { db, mail } = deps;
  const router = Router();
  const find = (raw: string) => {
    const id = Number(raw);
    return Number.isInteger(id) ? db.getJob(id) : undefined;
  };
  const notFound = { error: 'Vaga não encontrada.' };

  router.get('/', (_req, res) => {
    res.json(db.listJobs());
  });
  router.post('/', (req, res) => {
    const job = parseJob(req.body);
    if (typeof job === 'string') {
      res.status(400).json({ error: job });
      return;
    }
    res.status(201).json(db.createJob(job));
  });
  router.get('/export.csv', (_req, res) => {
    const rows = db.listJobs().map((job) => jobCsvColumns.map((key) => job[key] ?? ''));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vagas.csv"');
    // The BOM lets spreadsheet apps detect UTF-8.
    res.send(`﻿${stringify([[...jobCsvColumns], ...rows])}`);
  });
  router.post('/import', (req, res) => {
    const { csv } = req.body ?? {};
    if (typeof csv !== 'string' || !csv.trim()) {
      res.status(400).json({ error: 'Envie o conteúdo do CSV.' });
      return;
    }
    let records: Record<string, string>[];
    try {
      records = parse(csv, { columns: true, bom: true, skip_empty_lines: true, trim: true });
    } catch {
      res.status(400).json({ error: 'CSV inválido. Use o cabeçalho do arquivo exportado.' });
      return;
    }
    const jobs = [];
    for (const [index, record] of records.entries()) {
      const job = parseJob(record);
      if (typeof job === 'string') {
        res.status(400).json({ error: `Linha ${index + 2}: ${job} Nada foi importado.` });
        return;
      }
      const createdAt = record.createdAt && !Number.isNaN(Date.parse(record.createdAt)) ? record.createdAt : undefined;
      jobs.push({ job, createdAt });
    }
    db.importJobs(jobs);
    res.json({ imported: jobs.length });
  });
  router.patch('/:id', (req, res) => {
    if (!find(req.params.id)) {
      res.status(404).json(notFound);
      return;
    }
    const job = parseJob(req.body);
    if (typeof job === 'string') {
      res.status(400).json({ error: job });
      return;
    }
    res.json(db.updateJob(Number(req.params.id), job));
  });
  router.delete('/:id', (req, res) => {
    if (!db.deleteJob(Number(req.params.id))) {
      res.status(404).json(notFound);
      return;
    }
    res.json({ deleted: Number(req.params.id) });
  });
  router.get('/:id/emails', (req, res) => {
    const job = find(req.params.id);
    if (!job) {
      res.status(404).json(notFound);
      return;
    }
    res.json(db.listEmails(job.id));
  });
  router.get('/:id/preview', async (req, res) => {
    const job = find(req.params.id);
    if (!job) {
      res.status(404).json(notFound);
      return;
    }
    res.json(await compose(deps, job));
  });
  router.post('/:id/send', async (req, res) => {
    const job = find(req.params.id);
    if (!job) {
      res.status(404).json(notFound);
      return;
    }
    const email = await compose(deps, job);
    if (email.problems.length) {
      res.status(400).json({ error: email.problems.join(' ') });
      return;
    }
    const record = {
      jobId: job.id,
      to: email.to,
      subject: email.subject,
      body: email.body,
      resumeId: job.resumeId,
      attachment: email.attachment,
    };
    let pdf: Buffer;
    try {
      pdf = await deps.renderPdf(job.resumeId);
    } catch (e) {
      const error = (e as Error).message;
      db.addEmail({ ...record, messageId: null, error });
      res.status(502).json({ error });
      return;
    }
    try {
      const messageId = await mail.send({
        to: email.to,
        toName: email.toName,
        subject: email.subject,
        text: email.body,
        attachment: { filename: email.attachment, content: pdf },
      });
      db.addEmail({ ...record, messageId, error: null });
      const updated = db.updateJob(job.id, {
        ...job,
        status: job.status === 'rascunho' ? 'enviado' : job.status,
        appliedAt: job.appliedAt ?? today(),
      });
      res.json({ job: updated, messageId });
    } catch (e) {
      const error = mailError(e, (await mail.view())?.provider);
      db.addEmail({ ...record, messageId: null, error });
      res.status(502).json({ error });
    }
  });
  return router;
}

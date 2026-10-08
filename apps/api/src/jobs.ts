import { jobCsvColumns, parseJob } from '@cv-studio/core/jobs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { Router } from 'express';
import { type ApplicationDeps, ApplicationError, composeEmail, sendApplication } from './applications';

export function jobsRouter(deps: ApplicationDeps) {
  const { db } = deps;
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
    res.json(await composeEmail(deps, job));
  });
  router.post('/:id/send', async (req, res) => {
    const job = find(req.params.id);
    if (!job) {
      res.status(404).json(notFound);
      return;
    }
    try {
      res.json(await sendApplication(deps, job));
    } catch (e) {
      if (!(e instanceof ApplicationError)) throw e;
      res.status(e.status).json({ error: e.message });
    }
  });
  return router;
}

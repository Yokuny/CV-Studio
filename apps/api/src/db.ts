import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Job, JobInput, JobStatus, SentEmail } from '@cv-studio/core/jobs';

// Each entry upgrades the schema by one step; PRAGMA user_version records how many ran.
const migrations = [
  `CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    recruiter_name TEXT NOT NULL DEFAULT '',
    recruiter_email TEXT NOT NULL DEFAULT '',
    job_url TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    resume_id TEXT NOT NULL DEFAULT 'base',
    subject TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'rascunho',
    notes TEXT NOT NULL DEFAULT '',
    applied_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    to_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    resume_id TEXT NOT NULL,
    attachment TEXT NOT NULL DEFAULT '',
    message_id TEXT,
    error TEXT,
    sent_at TEXT NOT NULL
  );
  CREATE INDEX emails_job ON emails(job_id);`,
];

type Row = Record<string, string | number | null>;
const toJob = (r: Row): Job => ({
  id: Number(r.id),
  company: String(r.company),
  role: String(r.role),
  recruiterName: String(r.recruiter_name),
  recruiterEmail: String(r.recruiter_email),
  jobUrl: String(r.job_url),
  source: String(r.source),
  resumeId: String(r.resume_id),
  subject: String(r.subject),
  status: String(r.status) as JobStatus,
  notes: String(r.notes),
  appliedAt: r.applied_at === null ? null : String(r.applied_at),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});
const toEmail = (r: Row): SentEmail => ({
  id: Number(r.id),
  jobId: Number(r.job_id),
  to: String(r.to_address),
  subject: String(r.subject),
  body: String(r.body),
  resumeId: String(r.resume_id),
  attachment: String(r.attachment),
  messageId: r.message_id === null ? null : String(r.message_id),
  error: r.error === null ? null : String(r.error),
  sentAt: String(r.sent_at),
});
const params = (job: JobInput) => [
  job.company,
  job.role,
  job.recruiterName,
  job.recruiterEmail,
  job.jobUrl,
  job.source,
  job.resumeId,
  job.subject,
  job.status,
  job.notes,
  job.appliedAt,
];

/**
 * Jobs and sent emails in data/cv-studio.db, with the SQLite built into Node. The file is
 * versioned in Git, so it uses a rollback journal instead of WAL and stays a single file at rest.
 */
export function openDatabase(dataRoot: string) {
  mkdirSync(dataRoot, { recursive: true });
  const db = new DatabaseSync(path.join(dataRoot, 'cv-studio.db'));
  // The `pnpm cv job` CLI may write while the dev API has the file open.
  db.exec('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const version = Number((db.prepare('PRAGMA user_version').get() as Row).user_version);
  for (const [index, sql] of migrations.entries()) {
    if (index < version) continue;
    db.exec(`BEGIN; ${sql}; PRAGMA user_version = ${index + 1}; COMMIT;`);
  }
  const now = () => new Date().toISOString();
  const get = (id: number) => {
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Row | undefined;
    return row && toJob(row);
  };

  return {
    close: () => db.close(),
    listJobs() {
      return (db.prepare('SELECT * FROM jobs ORDER BY updated_at DESC, id DESC').all() as Row[]).map(toJob);
    },
    getJob: get,
    createJob(job: JobInput, createdAt = now()) {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO jobs (company, role, recruiter_name, recruiter_email, job_url, source, resume_id, subject,
            status, notes, applied_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...params(job), createdAt, now());
      return get(Number(lastInsertRowid)) as Job;
    },
    updateJob(id: number, job: JobInput) {
      db.prepare(
        `UPDATE jobs SET company = ?, role = ?, recruiter_name = ?, recruiter_email = ?, job_url = ?, source = ?,
          resume_id = ?, subject = ?, status = ?, notes = ?, applied_at = ?, updated_at = ? WHERE id = ?`,
      ).run(...params(job), now(), id);
      return get(id);
    },
    deleteJob(id: number) {
      return db.prepare('DELETE FROM jobs WHERE id = ?').run(id).changes > 0;
    },
    /** Imports many jobs at once; nothing is written if one fails. */
    importJobs(jobs: { job: JobInput; createdAt?: string }[]) {
      db.exec('BEGIN');
      try {
        for (const { job, createdAt } of jobs) this.createJob(job, createdAt);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    listEmails(jobId: number) {
      return (
        db.prepare('SELECT * FROM emails WHERE job_id = ? ORDER BY sent_at DESC, id DESC').all(jobId) as Row[]
      ).map(toEmail);
    },
    addEmail(email: Omit<SentEmail, 'id' | 'sentAt'>) {
      db.prepare(
        `INSERT INTO emails (job_id, to_address, subject, body, resume_id, attachment, message_id, error, sent_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        email.jobId,
        email.to,
        email.subject,
        email.body,
        email.resumeId,
        email.attachment,
        email.messageId,
        email.error,
        now(),
      );
    },
  };
}
export type Database = ReturnType<typeof openDatabase>;

export const jobStatuses = ['rascunho', 'enviado', 'entrevista', 'recusado', 'oferta'] as const;
export type JobStatus = (typeof jobStatuses)[number];
export const jobStatusLabels: Record<JobStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  entrevista: 'Entrevista',
  recusado: 'Recusado',
  oferta: 'Oferta',
};
export const defaultSubject = 'Candidatura — {{cargo}}';

export interface Job {
  id: number;
  company: string;
  role: string;
  recruiterName: string;
  recruiterEmail: string;
  jobUrl: string;
  source: string;
  /** Resume version (slug in content/cv) whose PDF and pitch are sent. */
  resumeId: string;
  subject: string;
  status: JobStatus;
  notes: string;
  /** ISO date (YYYY-MM-DD) of the application; set on the first successful send. */
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export type JobInput = Omit<Job, 'id' | 'createdAt' | 'updatedAt'>;

export interface SentEmail {
  id: number;
  jobId: number;
  to: string;
  subject: string;
  body: string;
  resumeId: string;
  attachment: string;
  messageId: string | null;
  error: string | null;
  sentAt: string;
}

export const emailPattern = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const limits = {
  company: 200,
  role: 200,
  recruiterName: 200,
  recruiterEmail: 320,
  jobUrl: 2000,
  source: 200,
  subject: 300,
  notes: 10000,
} as const;

export function emptyJob(resumeId = 'base'): JobInput {
  return {
    company: '',
    role: '',
    recruiterName: '',
    recruiterEmail: '',
    jobUrl: '',
    source: '',
    resumeId,
    subject: defaultSubject,
    status: 'rascunho',
    notes: '',
    appliedAt: null,
  };
}

/** Validates a job sent by the UI or read from CSV; returns the normalized job or an error message. */
export function parseJob(value: unknown): JobInput | string {
  if (!value || typeof value !== 'object') return 'Vaga inválida.';
  const v = value as Record<string, unknown>;
  const job = emptyJob();
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    const field = v[key] ?? '';
    if (typeof field !== 'string') return `Campo ${key} inválido.`;
    if (field.length > limits[key]) return `Campo ${key} acima de ${limits[key]} caracteres.`;
    job[key] = field.trim();
  }
  if (!job.company) return 'Informe a empresa.';
  if (!job.role) return 'Informe o cargo.';
  if (job.recruiterEmail && !emailPattern.test(job.recruiterEmail)) return 'Email de quem recruta inválido.';
  if (job.jobUrl && !/^https?:\/\//i.test(job.jobUrl)) return 'O link da vaga deve começar com http:// ou https://.';
  if (!job.subject) job.subject = defaultSubject;
  const resumeId = v.resumeId ?? 'base';
  if (typeof resumeId !== 'string' || !slugPattern.test(resumeId)) return 'Versão do currículo inválida.';
  job.resumeId = resumeId;
  const status = v.status ?? 'rascunho';
  if (!jobStatuses.includes(status as JobStatus)) return 'Status inválido.';
  job.status = status as JobStatus;
  const appliedAt = v.appliedAt || null;
  if (appliedAt !== null && (typeof appliedAt !== 'string' || !datePattern.test(appliedAt)))
    return 'Data de candidatura inválida (use AAAA-MM-DD).';
  job.appliedAt = appliedAt;
  return job;
}

/** Column order of the CSV export, also accepted by the import. */
export const jobCsvColumns = [
  'company',
  'role',
  'recruiterName',
  'recruiterEmail',
  'jobUrl',
  'source',
  'resumeId',
  'subject',
  'status',
  'notes',
  'appliedAt',
  'createdAt',
] as const;

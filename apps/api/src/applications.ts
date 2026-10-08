import type { Job } from '@cv-studio/core/jobs';
import { pitchTodo, renderTemplate, resumeName } from '@cv-studio/core/pitch';
import type { Database } from './db';
import { type MailAccount, mailError } from './mail';
import { renderPdf } from './pdf';
import type { ResumeFiles } from './repository';

/** What an application needs: the jobs database, the resume files, the email account and the PDF printer. */
export interface ApplicationDeps {
  db: Database;
  files: ResumeFiles;
  mail: MailAccount;
  renderPdf: (id: string) => Promise<Buffer>;
}

/** Prints a version found in content/cv with the shared resume renderer. */
export function printVersion(files: ResumeFiles) {
  return async (id: string) => {
    const resume = await files.find(id);
    if (!resume) throw new Error(`A versão "${id}" não foi encontrada em content/cv.`);
    return (await renderPdf(resume)).pdf;
  };
}

/** Today's date (YYYY-MM-DD) in the local time zone, like the date input of the UI. */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fills subject and pitch for a job, exactly as it will be sent; `problems` lists what blocks sending. */
export async function composeEmail({ files }: Pick<ApplicationDeps, 'files'>, job: Job) {
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
export type ComposedEmail = Awaited<ReturnType<typeof composeEmail>>;

export class ApplicationError extends Error {
  constructor(
    message: string,
    /** 400 when the email cannot be sent as it is; 502 when the printer or the provider failed. */
    readonly status: 400 | 502,
  ) {
    super(message);
  }
}

/**
 * Sends the email of a job with the PDF of its version. Every attempt, failures included, goes to
 * the history; the first success marks the job as sent with today's date.
 */
export async function sendApplication(deps: ApplicationDeps, job: Job) {
  const { db, mail } = deps;
  const email = await composeEmail(deps, job);
  if (email.problems.length) throw new ApplicationError(email.problems.join(' '), 400);
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
    throw new ApplicationError(error, 502);
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
    }) as Job;
    return { job: updated, messageId };
  } catch (e) {
    const error = mailError(e, (await mail.view())?.provider);
    db.addEmail({ ...record, messageId: null, error });
    throw new ApplicationError(error, 502);
  }
}

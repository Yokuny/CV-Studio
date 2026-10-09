// CLI used by the cv-studio skill: `pnpm cv init | list | new | check | pdf | job`. It shares the rules of the local API.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type Job, type JobInput, jobStatusLabels, jobTitle, parseJob } from '@cv-studio/core/jobs';
import { mailConnected } from '@cv-studio/core/mail';
import { defaultLayout, slugify, starterMarkdown } from '@cv-studio/core/model';
import { defaultPitch, pitchLimit } from '@cv-studio/core/pitch';
import { ApplicationError, composeEmail, printVersion, sendApplication } from '../src/applications';
import { checkVersions } from '../src/check';
import { openDatabase } from '../src/db';
import { mailAccount } from '../src/mail';
import { contentRoot, dataRoot, repoRoot } from '../src/paths';
import { closePdfBrowser, renderPdf } from '../src/pdf';
import { resumeFiles } from '../src/repository';

const root = contentRoot;
const files = resumeFiles(root);
const pdfRoot = path.join(repoRoot, 'output/pdf');
const usage = `Uso:
  pnpm cv init [--file <curriculo.md>]           Cria o currículo base (modelo vazio ou o Markdown informado)
  pnpm cv list                                   Lista as versões
  pnpm cv new <slug> --name "<nome>" [--from base]  Cria a versão (e o pitch) copiando a origem
  pnpm cv check [slug]                           Valida Markdown, layout, meta e pitch
  pnpm cv pdf <slug> [--check]                   Gera output/pdf/<slug>.pdf com o layout da versão
  pnpm cv job list                               Lista as vagas de data/cv-studio.db
  pnpm cv job add --resume <slug> --company "…" --role "…" [--recruiter "…"] [--email …]
                  [--url …] [--source …] [--subject "…"] [--notes-file <arquivo>]
                                                 Cadastra a vaga como rascunho
  pnpm cv job update <id> [os mesmos campos]     Altera os campos da vaga
  pnpm cv job preview <id>                       Mostra o email como será enviado e gera o PDF
  pnpm cv job send <id> --yes                    Envia o email com o PDF (sem --yes, só mostra a prévia)`;

/** Prints a version to output/pdf (ignored by Git) and reports its pages and layout problems. */
async function printToFile(id: string) {
  const resume = await files.find(id);
  if (!resume) throw new Error(`A versão "${id}" não foi encontrada em content/cv.`);
  const printed = await renderPdf(resume);
  await fs.mkdir(pdfRoot, { recursive: true });
  const file = path.join(pdfRoot, `${id}.pdf`);
  await fs.writeFile(file, printed.pdf);
  return { ...printed, file: path.relative(repoRoot, file) };
}

const jobFields = {
  resume: 'resumeId',
  company: 'company',
  role: 'role',
  recruiter: 'recruiterName',
  email: 'recruiterEmail',
  url: 'jobUrl',
  source: 'source',
  subject: 'subject',
} as const;

async function jobInput(values: Record<string, string | boolean | undefined>, current?: JobInput) {
  const input: Record<string, unknown> = { ...current };
  for (const [flag, key] of Object.entries(jobFields)) if (typeof values[flag] === 'string') input[key] = values[flag];
  // pnpm runs the script in apps/api; INIT_CWD is where `pnpm cv` was typed.
  const notesFile = values['notes-file'];
  if (typeof notesFile === 'string')
    input.notes = await fs.readFile(path.resolve(process.env.INIT_CWD ?? process.cwd(), notesFile), 'utf8');
  return parseJob(input);
}

async function jobCommand(sub: string | undefined, positionals: string[], values: Record<string, unknown>) {
  const db = openDatabase(dataRoot);
  const mail = mailAccount(dataRoot);
  const deps = { db, files, mail, renderPdf: printVersion(files) };
  const job = (): Job => {
    const id = Number(positionals[0]);
    const value = Number.isInteger(id) ? db.getJob(id) : undefined;
    if (!value) throw new Error(`Vaga "${positionals[0] ?? ''}" não encontrada. Veja os ids com: pnpm cv job list`);
    return value;
  };
  const describe = (j: Job) =>
    `#${j.id}  ${jobTitle(j)}  [${jobStatusLabels[j.status]}]  versão ${j.resumeId}${j.recruiterEmail ? `  → ${j.recruiterEmail}` : ''}`;

  /** The email exactly as it will be sent, with the PDF written to output/pdf for review. */
  const preview = async (j: Job) => {
    const email = await composeEmail(deps, j);
    const account = await mail.view();
    const problems = [...email.problems];
    if (!mailConnected(account))
      problems.push('Conecte uma conta de email na aba Vagas: Gmail com senha de app ou Outlook com login Microsoft.');
    const printed = await printToFile(j.resumeId);
    problems.push(...printed.issues.map((issue) => `PDF: ${issue}`));
    console.log(describe(j));
    console.log(
      `De:      ${account ? (account.fromName ? `${account.fromName} <${account.user}>` : account.user) : '—'}`,
    );
    console.log(`Para:    ${email.to ? (email.toName ? `${email.toName} <${email.to}>` : email.to) : '—'}`);
    console.log(`Assunto: ${email.subject}`);
    console.log(`Anexo:   ${email.attachment} (${printed.pages} página(s)) — prévia em ${printed.file}`);
    console.log(`Pitch:   ${email.usesBasePitch ? 'base (base.pitch.md)' : `content/cv/${j.resumeId}.pitch.md`}`);
    console.log(`----- corpo do email -----\n${email.body.trimEnd()}\n--------------------------`);
    const history = db.listEmails(j.id);
    console.log(
      history.length
        ? `Envios anteriores:\n${history
            .map(
              (e) =>
                `  - ${e.sentAt} → ${e.to}: ${e.messageId ? `aceito pelo servidor (${e.messageId})` : `falhou (${e.error})`}`,
            )
            .join('\n')}`
        : 'Envios anteriores: nenhum.',
    );
    if (problems.length) console.log(`Pendências:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    return problems;
  };

  try {
    if (sub === 'list') {
      const jobs = db.listJobs();
      for (const j of jobs) console.log(describe(j));
      if (!jobs.length) console.log('Nenhuma vaga cadastrada.');
      return 0;
    }
    if (sub === 'add') {
      const input = await jobInput(values as Record<string, string>);
      if (typeof input === 'string') throw new Error(input);
      if (!(await files.find(input.resumeId)))
        throw new Error(`A versão "${input.resumeId}" não existe em content/cv.`);
      const created = db.createJob({ ...input, status: 'rascunho', appliedAt: null });
      console.log(`Vaga criada em data/cv-studio.db: ${describe(created)}`);
      return 0;
    }
    if (sub === 'update') {
      const { id: _id, createdAt: _c, updatedAt: _u, ...current } = job();
      const input = await jobInput(values as Record<string, string>, current);
      if (typeof input === 'string') throw new Error(input);
      if (!(await files.find(input.resumeId)))
        throw new Error(`A versão "${input.resumeId}" não existe em content/cv.`);
      // The CLI edits the application data; status and date follow the sends.
      const updated = db.updateJob(job().id, { ...input, status: current.status, appliedAt: current.appliedAt });
      console.log(`Vaga atualizada: ${describe(updated as Job)}`);
      return 0;
    }
    if (sub === 'preview') {
      await preview(job());
      return 0;
    }
    if (sub === 'send') {
      const j = job();
      if (values.yes !== true) {
        await preview(j);
        console.log(
          `\nNada foi enviado. Mostre esta prévia e, com a confirmação explícita deste envio, rode: pnpm cv job send ${j.id} --yes`,
        );
        return 2;
      }
      const problems = [...(await composeEmail(deps, j)).problems];
      if (!mailConnected(await mail.view())) problems.push('Conecte uma conta de email na aba Vagas.');
      if (problems.length) throw new Error(`Envio bloqueado: ${problems.join(' ')}`);
      const { job: sent, messageId } = await sendApplication(deps, j);
      console.log(
        `Email aceito pelo servidor SMTP para ${sent.recruiterEmail} (${messageId}); confira a pasta Enviados da conta. ${describe(sent)}`,
      );
      return 0;
    }
    console.log(usage);
    return 1;
  } catch (e) {
    if (e instanceof ApplicationError) {
      console.error(e.message);
      return 1;
    }
    throw e;
  } finally {
    db.close();
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      name: { type: 'string' },
      from: { type: 'string', default: 'base' },
      check: { type: 'boolean' },
      yes: { type: 'boolean' },
      resume: { type: 'string' },
      company: { type: 'string' },
      role: { type: 'string' },
      recruiter: { type: 'string' },
      email: { type: 'string' },
      url: { type: 'string' },
      source: { type: 'string' },
      subject: { type: 'string' },
      'notes-file': { type: 'string' },
      file: { type: 'string' },
    },
  });
  if (command === 'init') {
    if (await files.find('base')) {
      console.error('content/cv/base.md já existe; edite-o em vez de recriar.');
      return 1;
    }
    const markdown = values.file ? await fs.readFile(values.file, 'utf8') : starterMarkdown;
    await fs.mkdir(root, { recursive: true });
    await files.write({ id: 'base', name: 'Currículo base', markdown, layout: defaultLayout });
    if (!(await files.readPitch('base'))) await files.writePitch('base', defaultPitch);
    console.log(
      `Criado content/cv/base.md (+ .layout.json, .meta.json, .pitch.md)${values.file ? ` a partir de ${values.file}` : ' com o modelo vazio'}. Esses arquivos ficam só nesta máquina (fora do Git).`,
    );
    return 0;
  }
  if (command === 'list') {
    const ids = await files.ids().catch((): string[] => []);
    if (!ids.includes('base')) console.log('Sem currículo base: rode `pnpm cv init` para começar.');
    for (const id of ids.sort((a, b) => (a === 'base' ? -1 : b === 'base' ? 1 : a.localeCompare(b)))) {
      const { name } = await files.load(id);
      console.log(`${id.padEnd(40)} ${name}`);
    }
    return 0;
  }
  if (command === 'new') {
    const [slug] = positionals;
    const name = values.name ?? slug;
    if (!slug || slug !== slugify(slug)) {
      console.error(`Informe um slug em minúsculas com hífens (sugestão: ${slugify(name ?? '') || 'nome-da-vaga'}).`);
      return 1;
    }
    if (!(await files.find(values.from))) {
      console.error(
        values.from === 'base'
          ? 'Sem content/cv/base.md: rode `pnpm cv init` antes de criar versões.'
          : `A versão "${values.from}" não foi encontrada em content/cv.`,
      );
      return 1;
    }
    const resume = await files.copy(values.from, slug, name);
    console.log(
      `Criado content/cv/${slug}.md (+ .layout.json, .meta.json, .pitch.md) a partir de "${values.from}": ${resume.name}`,
    );
    if (resume.pruned.length)
      console.log(
        `Limite de ${pitchLimit} pitches: removido(s) ${resume.pruned.map((id) => `content/cv/${id}.pitch.md`).join(', ')}.`,
      );
    return 0;
  }
  if (command === 'check') {
    const issues = await checkVersions(root, positionals[0]);
    for (const { level, file, message } of issues) console.log(`${level.padEnd(5)} content/cv/${file}: ${message}`);
    const errors = issues.filter((issue) => issue.level === 'erro').length;
    console.log(errors ? `${errors} erro(s).` : 'OK — arquivos válidos para a interface.');
    return errors ? 1 : 0;
  }
  if (command === 'pdf') {
    const [slug] = positionals;
    if (!slug) {
      console.log(usage);
      return 1;
    }
    const { file, pages, issues } = await printToFile(slug);
    console.log(`Gerado ${file} (${pages} página(s), A4, layout de content/cv/${slug}.layout.json).`);
    for (const issue of issues) console.log(`aviso ${issue}`);
    return values.check && issues.length ? 1 : 0;
  }
  if (command === 'job') return jobCommand(positionals[0], positionals.slice(1), values);
  console.log(usage);
  return command ? 1 : 0;
}

try {
  process.loadEnvFile(path.join(repoRoot, '.env.local'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
main().then(
  async (code) => {
    await closePdfBrowser();
    process.exit(code);
  },
  async (error) => {
    console.error((error as Error).message);
    await closePdfBrowser();
    process.exit(1);
  },
);

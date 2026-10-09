import { type Job, type JobStatus, jobStatuses, jobStatusLabels, jobTitle } from '@cv-studio/core/jobs';
import { mailConnected } from '@cv-studio/core/mail';
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Pencil, Plus, RotateCw, Send } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { IconButton } from '@/components/icon-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/date';
import { useJobs } from '@/store/jobs';
import { selectCurrent, useResumes } from '@/store/resumes';

function StatusSelect({ job }: { job: Job }) {
  const setStatus = useJobs((s) => s.setStatus);
  return (
    <Select value={job.status} onValueChange={(status) => void setStatus(job, status as JobStatus)}>
      <SelectTrigger size="sm" className="job-status" aria-label={`Status de ${jobTitle(job)}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {jobStatuses.map((status) => (
          <SelectItem key={status} value={status}>
            {jobStatusLabels[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function JobRow({ job }: { job: Job }) {
  const versionName = useResumes((s) => s.versions.find((v) => v.id === job.resumeId)?.name);
  const isCurrentResume = useResumes((s) => selectCurrent(s).id === job.resumeId);
  const setEditing = useJobs((s) => s.setEditing);
  const setSendingId = useJobs((s) => s.setSendingId);
  return (
    <TableRow data-current-resume={isCurrentResume ? 'true' : undefined}>
      <TableCell className="whitespace-normal">
        <div className="job-title">
          {job.role}
          {job.jobUrl && (
            <a href={job.jobUrl} target="_blank" rel="noreferrer" aria-label="Abrir anúncio da vaga">
              <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div className="job-sub whitespace-nowrap">
          {job.company || '—'}
          {job.source && ` · ${job.source}`}
        </div>
      </TableCell>
      <TableCell className="whitespace-normal">
        <div>{job.recruiterName || '—'}</div>
        <div className="job-sub">{job.recruiterEmail || 'sem email'}</div>
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="job-sub">
          {versionName ?? (
            <span
              className="line-through decoration-red-500 decoration-1"
              title="Esta versão não existe mais em content/cv"
            >
              {job.resumeId}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <StatusSelect job={job} />
      </TableCell>
      <TableCell className="tabular-nums">{formatDate(job.appliedAt)}</TableCell>
      {/* Sticky, so long rows never push the send button out of view. */}
      <TableCell className="job-actions text-right whitespace-nowrap">
        <div className="flex justify-end gap-2">
          <IconButton
            label="Editar vaga"
            variant={job.status === 'rascunho' ? 'default' : 'secondary'}
            size="icon-sm"
            onClick={() => setEditing(job)}
          >
            <Pencil />
          </IconButton>
          <IconButton
            label={job.appliedAt ? 'Revisar e reenviar email' : 'Revisar e enviar email'}
            variant={job.status === 'rascunho' && !job.appliedAt ? 'success' : 'secondary'}
            size="icon-sm"
            onClick={() => setSendingId(job.id)}
          >
            {job.appliedAt ? <RotateCw /> : <Send />}
          </IconButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Jobs saved in data/cv-studio.db, with the email account used to apply. */
export function JobsPanel() {
  const jobs = useJobs((s) => s.jobs);
  const ready = useJobs((s) => s.ready);
  const filter = useJobs((s) => s.filter);
  const account = useJobs((s) => s.account);
  const { load, setFilter, setEditing, setAccountOpen, importCsv } = useJobs.getState();
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void load();
  }, [load]);
  const visible = filter === 'todas' ? jobs : jobs.filter((job) => job.status === filter);

  return (
    <section className="jobs-panel no-print" aria-label="Vagas cadastradas">
      <div className="jobs-toolbar">
        <div className="jobs-actions">
          <Button variant="secondary" size="sm" onClick={() => setAccountOpen(true)}>
            {account ? account.user : 'Conectar email'}
            <Badge
              variant={mailConnected(account) ? 'secondary' : 'outline'}
              className={mailConnected(account) ? 'bg-emerald-100 text-emerald-800' : undefined}
            >
              {mailConnected(account) ? 'conectado' : 'pendente'}
            </Badge>
          </Button>
        </div>
        <div className="jobs-actions ml-auto justify-end">
          <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <SelectTrigger size="sm" aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              {jobStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {jobStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <IconButton label="Importar CSV" variant="ghost" size="icon-sm" onClick={() => importRef.current?.click()}>
            <ArrowUpFromLine />
          </IconButton>
          <IconButton label="Exportar CSV" variant="ghost" size="icon-sm" asChild>
            <a href="/api/jobs/export.csv" download="vagas.csv">
              <ArrowDownToLine />
            </a>
          </IconButton>
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus /> Nova vaga
          </Button>
        </div>
      </div>
      <p className="small-note mb-2">
        {jobs.length} cadastrada(s) em data/cv-studio.db. {jobs.filter((j) => j.appliedAt).length} com candidatura
        enviada.
      </p>
      {ready && visible.length === 0 ? (
        <div className="jobs-empty">
          {jobs.length === 0
            ? 'Nenhuma vaga ainda. Cadastre a primeira com empresa, cargo e o email de quem recruta.'
            : 'Nenhuma vaga com este status.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vaga</TableHead>
              <TableHead>Recrutadora</TableHead>
              <TableHead>Currículo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Candidatura</TableHead>
              <TableHead className="job-actions text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </TableBody>
        </Table>
      )}
      <input
        ref={importRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label="Importar arquivo CSV"
        onChange={(e) => {
          void importCsv(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </section>
  );
}

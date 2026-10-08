import { type Job, type JobStatus, jobStatuses, jobStatusLabels } from '@cv-studio/core/jobs';
import { mailConnected } from '@cv-studio/core/mail';
import { ArrowDownToLine, ArrowUpFromLine, AtSign, ExternalLink, Pencil, Plus, Send } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { IconButton } from '@/components/icon-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useJobs } from '@/store/jobs';
import { useResumes } from '@/store/resumes';

const formatDate = (date: string | null) =>
  date ? new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

function StatusSelect({ job }: { job: Job }) {
  const setStatus = useJobs((s) => s.setStatus);
  return (
    <Select value={job.status} onValueChange={(status) => void setStatus(job, status as JobStatus)}>
      <SelectTrigger size="sm" className="job-status" aria-label={`Status de ${job.role} — ${job.company}`}>
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
  const setEditing = useJobs((s) => s.setEditing);
  const setSendingId = useJobs((s) => s.setSendingId);
  return (
    <TableRow>
      <TableCell>
        <div className="job-title">
          {job.role}
          {job.jobUrl && (
            <a href={job.jobUrl} target="_blank" rel="noreferrer" aria-label="Abrir anúncio da vaga">
              <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div className="job-sub">
          {job.company}
          {job.source && ` · ${job.source}`}
        </div>
      </TableCell>
      <TableCell>
        <div>{job.recruiterName || '—'}</div>
        <div className="job-sub">{job.recruiterEmail || 'sem email'}</div>
      </TableCell>
      <TableCell>
        {versionName ?? (
          <span className="job-sub" title="Esta versão não existe mais em content/cv">
            {job.resumeId} (removida)
          </span>
        )}
      </TableCell>
      <TableCell>
        <StatusSelect job={job} />
      </TableCell>
      <TableCell className="tabular-nums">{formatDate(job.appliedAt)}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <IconButton label="Editar vaga" onClick={() => setEditing(job)}>
          <Pencil />
        </IconButton>
        <IconButton label="Revisar e enviar email" onClick={() => setSendingId(job.id)}>
          <Send />
        </IconButton>
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
        <div>
          <h1>Vagas</h1>
          <p className="small-note">
            {jobs.length} cadastrada(s) em data/cv-studio.db. {jobs.filter((j) => j.appliedAt).length} com candidatura
            enviada.
          </p>
        </div>
        <div className="jobs-actions">
          <Button variant="outline" size="sm" onClick={() => setAccountOpen(true)}>
            <AtSign />
            {account ? account.user : 'Conectar email'}
            <Badge variant={mailConnected(account) ? 'secondary' : 'outline'}>
              {mailConnected(account) ? 'conectado' : 'pendente'}
            </Badge>
          </Button>
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
          <IconButton label="Importar CSV" size="icon-sm" onClick={() => importRef.current?.click()}>
            <ArrowUpFromLine />
          </IconButton>
          <IconButton label="Exportar CSV" size="icon-sm" asChild>
            <a href="/api/jobs/export.csv" download="vagas.csv">
              <ArrowDownToLine />
            </a>
          </IconButton>
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus /> Nova vaga
          </Button>
        </div>
      </div>
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
              <TableHead className="text-right">Ações</TableHead>
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

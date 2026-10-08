import {
  emptyJob,
  type JobInput,
  type JobStatus,
  jobStatuses,
  jobStatusLabels,
  type SentEmail,
} from '@cv-studio/core/jobs';
import { pitchVariables } from '@cv-studio/core/pitch';
import { Save, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useJobs } from '@/store/jobs';
import { selectCurrent, useResumes } from '@/store/resumes';

function Field({ id, label, wide, children }: { id: string; label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'job-field col-span-2' : 'job-field'}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function EmailHistory({ jobId }: { jobId: number }) {
  const emails = useJobs((s) => s.emails);
  const [history, setHistory] = useState<SentEmail[]>([]);
  useEffect(() => {
    void emails(jobId).then(setHistory, () => setHistory([]));
  }, [jobId, emails]);
  if (!history.length) return null;
  return (
    <div className="email-history col-span-2">
      <Label>Envios</Label>
      <ul>
        {history.map((email) => (
          <li key={email.id} title={email.error ?? email.body}>
            <span className={email.error ? 'text-destructive' : undefined}>{email.error ? 'Falhou' : 'Enviado'}</span>
            {' · '}
            {new Date(email.sentAt).toLocaleString('pt-BR')} · {email.to} · {email.attachment}
            {email.error && ` — ${email.error}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function JobDialog() {
  const editing = useJobs((s) => s.editing);
  const setEditing = useJobs((s) => s.setEditing);
  const save = useJobs((s) => s.save);
  const remove = useJobs((s) => s.remove);
  const versions = useResumes((s) => s.versions);
  const currentId = useResumes((s) => selectCurrent(s).id);
  const [job, setJob] = useState<JobInput>(emptyJob());
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!editing) return;
    setConfirmDelete(false);
    if (editing === 'new') setJob(emptyJob(currentId || 'base'));
    else {
      const { id: _id, createdAt: _c, updatedAt: _u, ...input } = editing;
      setJob(input);
    }
  }, [editing, currentId]);
  const set = <K extends keyof JobInput>(key: K, value: JobInput[K]) => setJob((j) => ({ ...j, [key]: value }));
  const text = (key: keyof JobInput) => ({
    id: `job-${key}`,
    value: (job[key] as string | null) ?? '',
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });
  const versionMissing = !versions.some((v) => v.id === job.resumeId);

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing === 'new' ? 'Nova vaga' : 'Editar vaga'}</DialogTitle>
          <DialogDescription>
            Fica salva em data/cv-studio.db. O email usa o pitch e o PDF da versão escolhida.
          </DialogDescription>
        </DialogHeader>
        <form
          className="job-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await save(job);
            setBusy(false);
          }}
        >
          <Field id="job-company" label="Empresa *">
            <Input {...text('company')} required maxLength={200} autoFocus />
          </Field>
          <Field id="job-role" label="Cargo *">
            <Input {...text('role')} required maxLength={200} />
          </Field>
          <Field id="job-recruiterName" label="Nome de quem recruta">
            <Input {...text('recruiterName')} maxLength={200} />
          </Field>
          <Field id="job-recruiterEmail" label="Email de quem recruta">
            <Input {...text('recruiterEmail')} type="email" maxLength={320} />
          </Field>
          <Field id="job-jobUrl" label="Link da vaga">
            <Input {...text('jobUrl')} type="url" placeholder="https://" maxLength={2000} />
          </Field>
          <Field id="job-source" label="Origem">
            <Input {...text('source')} placeholder="LinkedIn, indicação, site…" maxLength={200} />
          </Field>
          <Field id="job-resumeId" label="Versão do currículo">
            <Select value={job.resumeId} onValueChange={(value) => set('resumeId', value)}>
              <SelectTrigger id="job-resumeId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versionMissing && <SelectItem value={job.resumeId}>{job.resumeId} (removida)</SelectItem>}
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="job-status" label="Status">
            <Select value={job.status} onValueChange={(value) => set('status', value as JobStatus)}>
              <SelectTrigger id="job-status" className="w-full">
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
          </Field>
          <Field id="job-subject" label="Assunto do email" wide>
            <Input {...text('subject')} maxLength={300} />
            <span className="small-note">Variáveis: {pitchVariables.map((v) => `{{${v.key}}}`).join(' ')}</span>
          </Field>
          <Field id="job-appliedAt" label="Data da candidatura">
            <Input
              id="job-appliedAt"
              type="date"
              value={job.appliedAt ?? ''}
              onChange={(e) => set('appliedAt', e.target.value || null)}
            />
          </Field>
          <Field id="job-notes" label="Notas" wide>
            <Textarea {...text('notes')} rows={3} maxLength={10000} />
          </Field>
          {editing && editing !== 'new' && <EmailHistory jobId={editing.id} />}
          <DialogFooter className="col-span-2 mt-2">
            {editing && editing !== 'new' && (
              <Button
                type="button"
                variant={confirmDelete ? 'destructive' : 'ghost'}
                className="mr-auto"
                onClick={() => (confirmDelete ? void remove(editing) : setConfirmDelete(true))}
              >
                <Trash2 /> {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !job.company.trim() || !job.role.trim()}>
              <Save /> Salvar vaga
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

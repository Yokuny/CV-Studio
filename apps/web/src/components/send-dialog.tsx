import { jobTitle } from '@cv-studio/core/jobs';
import { mailConnected } from '@cv-studio/core/mail';
import { LoaderCircle, MessageSquareText, Paperclip, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type EmailPreview, useJobs } from '@/store/jobs';
import { useResumes } from '@/store/resumes';
import { useUi } from '@/store/ui';

/** Shows the email exactly as it will be sent and sends it with the PDF of the chosen version. */
export function SendDialog() {
  const sendingId = useJobs((s) => s.sendingId);
  const job = useJobs((s) => s.jobs.find((j) => j.id === s.sendingId));
  const account = useJobs((s) => s.account);
  const { setSendingId, preview, send, setAccountOpen } = useJobs.getState();
  const [email, setEmail] = useState<EmailPreview | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setEmail(null);
    setError('');
    if (sendingId === null) return;
    preview(sendingId).then(setEmail, (e: Error) => setError(e.message));
  }, [sendingId, preview]);

  const editPitch = () => {
    if (!job) return;
    useResumes.getState().select(job.resumeId);
    useUi.getState().setPreview('pitch');
    setSendingId(null);
  };
  const problems = [
    ...(email?.problems ?? []),
    ...(mailConnected(account)
      ? []
      : ['Conecte uma conta de email: Gmail com senha de app ou Outlook com login Microsoft.']),
  ];

  return (
    <Dialog open={sendingId !== null} onOpenChange={(open) => !open && !sending && setSendingId(null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revisar email</DialogTitle>
          <DialogDescription>
            {job ? jobTitle(job) : ''}
            {account && ` · de ${account.fromName ? `${account.fromName} <${account.user}>` : account.user}`}
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!email && !error && <p className="small-note">Montando o email…</p>}
        {email && (
          <div className="email-preview">
            <dl>
              <dt>Para</dt>
              <dd>{email.toName ? `${email.toName} <${email.to}>` : email.to || '—'}</dd>
              <dt>Assunto</dt>
              <dd>{email.subject}</dd>
              <dt>Anexo</dt>
              <dd>
                <Paperclip size={12} /> {email.attachment}
              </dd>
            </dl>
            <pre>{email.body}</pre>
            {email.usesBasePitch && (
              <p className="small-note">Esta versão usa o pitch base. Personalize na aba Pitch para esta vaga.</p>
            )}
          </div>
        )}
        {email && problems.length > 0 && (
          <ul className="email-problems" role="alert">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" className="mr-auto" onClick={editPitch} disabled={!job || sending}>
            <MessageSquareText /> Editar pitch
          </Button>
          {!mailConnected(account) && (
            <Button type="button" variant="outline" onClick={() => setAccountOpen(true)}>
              Conectar email
            </Button>
          )}
          <Button
            disabled={!email || problems.length > 0 || sending || sendingId === null}
            onClick={async () => {
              if (sendingId === null) return;
              setSending(true);
              await send(sendingId);
              setSending(false);
            }}
          >
            {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
            {sending ? 'Gerando PDF e enviando…' : 'Enviar email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

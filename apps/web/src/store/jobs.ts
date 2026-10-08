import { type Job, type JobInput, type JobStatus, jobTitle, type SentEmail } from '@cv-studio/core/jobs';
import type {
  MailAccountInput,
  MailAccountView,
  OutlookLogin,
  OutlookLoginResult,
  OutlookStartInput,
} from '@cv-studio/core/mail';
import { create } from 'zustand';
import { api } from '@/lib/api';
import { notify } from './notice';
import { usePitches } from './pitches';
import { useResumes } from './resumes';

export interface EmailPreview {
  to: string;
  toName: string;
  subject: string;
  body: string;
  attachment: string;
  usesBasePitch: boolean;
  problems: string[];
}

interface JobsState {
  jobs: Job[];
  ready: boolean;
  filter: JobStatus | 'todas';
  /** Job open in the form dialog; 'new' for a job being created. */
  editing: Job | 'new' | null;
  /** Job whose email is being reviewed before sending. */
  sendingId: number | null;
  account: MailAccountView | null;
  accountOpen: boolean;
  outlookLogin: OutlookLogin | null;
  outlookStarting: boolean;
  outlookError: string;
  outlookConfigured: boolean;
  startOutlook: (input: OutlookStartInput) => Promise<void>;
  pollOutlook: () => Promise<void>;
  cancelOutlook: () => Promise<void>;
  load: () => Promise<void>;
  setFilter: (filter: JobsState['filter']) => void;
  setEditing: (editing: JobsState['editing']) => void;
  setSendingId: (id: number | null) => void;
  /** Creates or updates the job being edited; returns whether it was saved. */
  save: (input: JobInput) => Promise<boolean>;
  setStatus: (job: Job, status: JobStatus) => Promise<void>;
  remove: (job: Job) => Promise<void>;
  importCsv: (file?: File) => Promise<void>;
  /** Writes pending edits of the version and its pitch, then renders the email as it will be sent. */
  preview: (id: number) => Promise<EmailPreview>;
  send: (id: number) => Promise<boolean>;
  emails: (id: number) => Promise<SentEmail[]>;
  setAccountOpen: (open: boolean) => void;
  saveAccount: (input: MailAccountInput) => Promise<boolean>;
  connectAccount: (input: MailAccountInput) => Promise<boolean>;
  removeAccount: () => Promise<void>;
  verifyAccount: () => Promise<boolean>;
}

const replace = (jobs: Job[], job: Job) => [job, ...jobs.filter((j) => j.id !== job.id)];
let outlookAttempt = 0;

export const useJobs = create<JobsState>()((set, get) => ({
  jobs: [],
  ready: false,
  filter: 'todas',
  editing: null,
  sendingId: null,
  account: null,
  accountOpen: false,
  outlookLogin: null,
  outlookStarting: false,
  outlookError: '',
  outlookConfigured: false,

  load: async () => {
    try {
      const [jobs, account, outlook] = await Promise.all([
        api<Job[]>('jobs'),
        api<MailAccountView | null>('mail/account'),
        api<{ configured: boolean }>('mail/outlook/config'),
      ]);
      set({ jobs, account, outlookConfigured: outlook.configured, ready: true });
    } catch (error) {
      notify((error as Error).message);
    }
  },
  setFilter: (filter) => set({ filter }),
  setEditing: (editing) => set({ editing }),
  setSendingId: (sendingId) => set({ sendingId }),
  save: async (input) => {
    const { editing } = get();
    try {
      const job =
        editing && editing !== 'new'
          ? await api<Job>(`jobs/${editing.id}`, { method: 'PATCH', body: input })
          : await api<Job>('jobs', { method: 'POST', body: input });
      set((s) => ({ jobs: replace(s.jobs, job), editing: null }));
      notify(`Vaga “${jobTitle(job)}” salva em data/cv-studio.db.`);
      return true;
    } catch (error) {
      notify((error as Error).message);
      return false;
    }
  },
  setStatus: async (job, status) => {
    try {
      const { id: _id, createdAt: _c, updatedAt: _u, ...input } = job;
      const updated = await api<Job>(`jobs/${job.id}`, { method: 'PATCH', body: { ...input, status } });
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === job.id ? updated : j)) }));
    } catch (error) {
      notify((error as Error).message);
    }
  },
  remove: async (job) => {
    try {
      await api(`jobs/${job.id}`, { method: 'DELETE', body: {} });
      set((s) => ({ jobs: s.jobs.filter((j) => j.id !== job.id), editing: null }));
      notify(`Vaga “${jobTitle(job)}” excluída com seu histórico de envios.`);
    } catch (error) {
      notify((error as Error).message);
    }
  },
  importCsv: async (file) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) || file.size > 1000000) {
      notify('Escolha um arquivo .csv de até 1 MB.');
      return;
    }
    try {
      const { imported } = await api<{ imported: number }>('jobs/import', {
        method: 'POST',
        body: { csv: await file.text() },
      });
      await get().load();
      notify(`${imported} vaga(s) importada(s).`);
    } catch (error) {
      notify((error as Error).message);
    }
  },
  preview: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (job) {
      // The email uses the files on disk, so pending autosaves go first.
      if (useResumes.getState().versions.some((v) => v.id === job.resumeId))
        await useResumes.getState().saveById(job.resumeId, true);
      await usePitches.getState().saveById(job.resumeId, true);
    }
    return api<EmailPreview>(`jobs/${id}/preview`);
  },
  send: async (id) => {
    try {
      const { job, messageId } = await api<{ job: Job; messageId: string }>(`jobs/${id}/send`, {
        method: 'POST',
        body: {},
      });
      set((s) => ({ jobs: replace(s.jobs, job), sendingId: null }));
      notify(
        `Email aceito pelo servidor para ${job.recruiterEmail} (${messageId}). Confira a pasta Enviados da sua conta.`,
      );
      return true;
    } catch (error) {
      notify((error as Error).message);
      return false;
    }
  },
  emails: (id) => api<SentEmail[]>(`jobs/${id}/emails`),
  setAccountOpen: (accountOpen) => {
    set({ accountOpen });
    if (!accountOpen) void get().cancelOutlook();
  },
  startOutlook: async (input) => {
    const attempt = ++outlookAttempt;
    set({ outlookStarting: true, outlookError: '', outlookLogin: null });
    try {
      const login = await api<OutlookLogin>('mail/outlook/start', { method: 'POST', body: input });
      if (attempt !== outlookAttempt) {
        await api('mail/outlook/cancel', { method: 'POST', body: { sessionId: login.sessionId } });
        return;
      }
      set({ outlookLogin: login });
    } catch (error) {
      if (attempt === outlookAttempt) set({ outlookError: (error as Error).message });
    } finally {
      if (attempt === outlookAttempt) set({ outlookStarting: false });
    }
  },
  pollOutlook: async () => {
    const login = get().outlookLogin;
    if (!login) return;
    const attempt = outlookAttempt;
    try {
      const result = await api<OutlookLoginResult>('mail/outlook/poll', {
        method: 'POST',
        body: { sessionId: login.sessionId },
      });
      if (attempt !== outlookAttempt) return;
      if (result.status === 'connected') {
        set({ account: result.account, outlookLogin: null, outlookError: '' });
        notify('Outlook conectado. Login SMTP confirmado sem enviar email.');
      } else set({ outlookLogin: { ...login, interval: result.interval } });
    } catch (error) {
      if (attempt === outlookAttempt) set({ outlookLogin: null, outlookError: (error as Error).message });
    }
  },
  cancelOutlook: async () => {
    ++outlookAttempt;
    const login = get().outlookLogin;
    set({ outlookLogin: null, outlookStarting: false, outlookError: '' });
    if (!login) return;
    try {
      await api('mail/outlook/cancel', { method: 'POST', body: { sessionId: login.sessionId } });
    } catch (error) {
      notify((error as Error).message);
    }
  },
  saveAccount: async (input) => {
    try {
      const account = await api<MailAccountView>('mail/account', { method: 'PUT', body: input });
      set({ account });
      notify('Conta salva em data/mail-account.json (fora do Git).');
      return true;
    } catch (error) {
      notify((error as Error).message);
      return false;
    }
  },
  connectAccount: async (input) => {
    try {
      const account = await api<MailAccountView>('mail/connect', { method: 'POST', body: input });
      set({ account });
      notify('Conexão SMTP confirmada. Conta salva e pronta para enviar. Nenhum email foi enviado.');
      return true;
    } catch (error) {
      notify((error as Error).message);
      return false;
    }
  },
  removeAccount: async () => {
    try {
      await api('mail/account', { method: 'DELETE', body: {} });
      set({ account: null });
      notify('Conta de email desconectada.');
    } catch (error) {
      notify((error as Error).message);
    }
  },
  verifyAccount: async () => {
    try {
      await api('mail/verify', { method: 'POST', body: {} });
      set({ account: await api<MailAccountView>('mail/account') });
      notify('Conexão SMTP confirmada. A conta está pronta para enviar.');
      return true;
    } catch (error) {
      notify((error as Error).message);
      return false;
    }
  },
}));

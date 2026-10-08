import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  type MailAccountInput,
  type MailAccountView,
  mailPresets,
  type OutlookConnectInput,
  type OutlookLogin,
  type OutlookLoginResult,
} from '@cv-studio/core/mail';
import nodemailer from 'nodemailer';
import { OutlookOAuthError, type OutlookTokens, outlookOAuth } from './outlook-oauth';

type StoredAccount = MailAccountInput & { clientId?: string; oauth?: OutlookTokens; verified?: boolean };
interface PendingLogin extends OutlookConnectInput, OutlookLogin {
  deviceCode: string;
  nextPoll: number;
}

export interface MailOptions {
  fetch?: typeof fetch;
  now?: () => number;
  createTransport?: typeof nodemailer.createTransport;
}

/** Credentials stay in the ignored local file (0600); the UI receives only an explicit whitelist. */
export function mailAccount(dataRoot: string, options: MailOptions = {}) {
  const file = path.join(dataRoot, 'mail-account.json');
  const now = options.now ?? Date.now;
  const microsoft = outlookOAuth(options.fetch, now);
  const createTransport = options.createTransport ?? nodemailer.createTransport;
  let pending: PendingLogin | undefined;
  // Serialize token rotation, connection changes and logout so stale requests cannot restore credentials.
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(task: () => Promise<T>) => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  const load = async (): Promise<StoredAccount | undefined> => {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  };
  const view = (account: StoredAccount): MailAccountView => ({
    provider: account.provider,
    user: account.user,
    fromName: account.fromName,
    host: account.host,
    port: account.port,
    secure: account.secure,
    hasPassword: account.provider !== 'outlook' && Boolean(account.password),
    hasOAuth: account.provider === 'outlook' && Boolean(account.oauth?.refreshToken),
    verified: account.provider === 'outlook' ? Boolean(account.oauth?.refreshToken) : Boolean(account.verified),
  });
  const write = async (account: StoredAccount) => {
    await fs.mkdir(dataRoot, { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, `${JSON.stringify(account, null, 2)}\n`, { mode: 0o600 });
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  };
  const transport = (account: StoredAccount) =>
    createTransport({
      host: account.host,
      port: account.port,
      secure: account.secure,
      requireTLS: !account.secure && account.provider !== 'custom',
      auth:
        account.provider === 'outlook'
          ? { type: 'OAuth2', user: account.user, accessToken: account.oauth?.accessToken }
          : { user: account.user, pass: account.password },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
  const ready = async () => {
    const account = await load();
    if (account?.provider === 'outlook') {
      if (!account.oauth?.refreshToken || !account.clientId)
        throw new Error('Conecte sua conta Outlook com Entrar com Microsoft. A senha de aplicativo não é usada.');
      if (account.oauth.expiresAt <= now() + 60000) {
        account.oauth = await microsoft.refresh(account.clientId, account.oauth.refreshToken);
        await write(account);
      }
    } else if (!account?.password) throw new Error('Conecte uma conta de email primeiro.');
    return account;
  };
  const passwordAccount = async (input: MailAccountInput): Promise<StoredAccount> => {
    if (input.provider === 'outlook') throw new Error('Para conectar Outlook/Hotmail, use Entrar com Microsoft.');
    const stored = await load();
    const sameAccount = stored?.user === input.user && stored.provider === input.provider;
    const password = input.password || (sameAccount ? stored.password : '');
    const unchanged =
      sameAccount &&
      password === stored.password &&
      input.host === stored.host &&
      input.port === stored.port &&
      input.secure === stored.secure;
    return { ...input, password, verified: Boolean(unchanged && stored.verified) };
  };

  return {
    load,
    async view() {
      const account = await load();
      return account ? view(account) : null;
    },
    save(input: MailAccountInput) {
      return serialize(async () => {
        const account = await passwordAccount(input);
        pending = undefined;
        await write(account);
        return view(account);
      });
    },
    connect(input: MailAccountInput) {
      return serialize(async () => {
        const account = await passwordAccount(input);
        if (!account.password) throw new Error('Informe a senha de app da conta.');
        await transport(account).verify();
        account.verified = true;
        pending = undefined;
        await write(account);
        return view(account);
      });
    },
    remove() {
      return serialize(async () => {
        pending = undefined;
        await fs.rm(file, { force: true });
      });
    },
    startOutlook(input: OutlookConnectInput): Promise<OutlookLogin> {
      return serialize(async () => {
        pending = undefined;
        const device = await microsoft.start(input.clientId);
        pending = { ...input, ...device, sessionId: randomUUID(), nextPoll: now() + device.interval * 1000 };
        return {
          sessionId: pending.sessionId,
          userCode: pending.userCode,
          verificationUri: pending.verificationUri,
          expiresAt: pending.expiresAt,
          interval: pending.interval,
        };
      });
    },
    pollOutlook(sessionId: string): Promise<OutlookLoginResult> {
      return serialize(async () => {
        const login = pending;
        if (!login || login.sessionId !== sessionId)
          throw new Error('Esta conexão Microsoft foi cancelada. Inicie novamente.');
        if (now() >= login.expiresAt) {
          pending = undefined;
          throw new OutlookOAuthError('expired_token');
        }
        if (now() < login.nextPoll) return { status: 'pending', interval: login.interval };
        login.nextPoll = now() + login.interval * 1000;
        try {
          const oauth = await microsoft.poll(login.clientId, login.deviceCode);
          const account: StoredAccount = {
            provider: 'outlook',
            host: mailPresets.outlook.host,
            port: mailPresets.outlook.port,
            secure: mailPresets.outlook.secure,
            user: login.user,
            fromName: login.fromName,
            password: '',
            clientId: login.clientId,
            oauth,
          };
          // SMTP validates the authorized mailbox before replacing the existing account. No email is sent.
          await transport(account).verify();
          if (pending !== login) throw new Error('Esta conexão Microsoft foi cancelada. Inicie novamente.');
          const previous = await load();
          await write(account);
          if (pending !== login) {
            if (previous) await write(previous);
            else await fs.rm(file, { force: true });
            throw new Error('Esta conexão Microsoft foi cancelada. Inicie novamente.');
          }
          pending = undefined;
          return { status: 'connected', account: view(account) };
        } catch (e) {
          if (e instanceof OutlookOAuthError && ['authorization_pending', 'slow_down'].includes(e.code)) {
            if (e.code === 'slow_down') {
              login.interval += 5;
              login.nextPoll = now() + login.interval * 1000;
            }
            return { status: 'pending', interval: login.interval };
          }
          pending = undefined;
          throw e;
        }
      });
    },
    cancelOutlook(sessionId: string) {
      // Invalidate immediately, including an SMTP verification already in progress.
      if (pending?.sessionId === sessionId) pending = undefined;
      return serialize(async () => {});
    },
    /** Authenticates SMTP without sending. */
    verify() {
      return serialize(async () => {
        const account = await ready();
        await transport(account).verify();
        account.verified = true;
        await write(account);
      });
    },
    send(message: {
      to: string;
      toName: string;
      subject: string;
      text: string;
      attachment: { filename: string; content: Buffer };
    }) {
      return serialize(async () => {
        const account = await ready();
        const info = await transport(account).sendMail({
          from: account.fromName ? { name: account.fromName, address: account.user } : account.user,
          to: message.toName ? { name: message.toName, address: message.to } : message.to,
          subject: message.subject,
          text: message.text,
          attachments: [{ ...message.attachment, contentType: 'application/pdf' }],
        });
        return info.messageId as string;
      });
    },
  };
}
export type MailAccount = ReturnType<typeof mailAccount>;

export function mailError(error: unknown, provider?: MailAccountInput['provider']) {
  if (error instanceof OutlookOAuthError) return error.message;
  const e = error as { code?: string; responseCode?: number; message?: string };
  if ((e.code === 'EAUTH' || e.responseCode === 535) && provider === 'outlook')
    return 'O Outlook recusou a autorização SMTP. Entre com Microsoft novamente usando o mesmo email informado no sistema e autorize o envio de emails.';
  if ((e.code === 'EAUTH' || e.responseCode === 535 || e.responseCode === 534) && provider === 'gmail')
    return 'O Gmail recusou o login. Confira o email, ative a verificação em duas etapas e crie uma senha de app de 16 caracteres na Conta Google.';
  if (e.code === 'EAUTH' || e.responseCode === 535)
    return 'O servidor recusou o login. Use uma senha de app (não a senha normal) e confira o email.';
  if (e.code === 'ESOCKET' || e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT' || e.code === 'EDNS')
    return 'Não foi possível conectar ao servidor SMTP. Confira servidor, porta e sua conexão.';
  return e.message ?? 'Falha ao enviar o email.';
}

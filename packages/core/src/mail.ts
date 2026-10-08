export const mailProviders = ['gmail', 'outlook', 'custom'] as const;
export type MailProvider = (typeof mailProviders)[number];

export interface SmtpSettings {
  host: string;
  port: number;
  /** true for implicit TLS (465); false upgrades with STARTTLS (587). */
  secure: boolean;
}
export const mailPresets: Record<Exclude<MailProvider, 'custom'>, SmtpSettings & { label: string; help: string }> = {
  gmail: {
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    help: 'Ative a verificação em duas etapas na Conta Google e crie uma Senha de app (16 caracteres) em Segurança › Senhas de app.',
  },
  outlook: {
    label: 'Outlook / Hotmail',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    help: 'Use Entrar com Microsoft e autorize sua conta Outlook/Hotmail. Não é necessário criar uma senha de aplicativo.',
  },
};

/** The account as the UI sees it: the password never leaves the local API. */
export interface MailAccountView extends SmtpSettings {
  provider: MailProvider;
  user: string;
  fromName: string;
  hasPassword: boolean;
  hasOAuth: boolean;
  verified?: boolean;
}

/** What the UI sends to start the Microsoft login; the client ID comes only from .env.local. */
export interface OutlookStartInput {
  user: string;
  fromName: string;
}

export interface OutlookConnectInput extends OutlookStartInput {
  clientId: string;
}

export interface OutlookLogin {
  sessionId: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  interval: number;
}

export type OutlookLoginResult =
  | { status: 'pending'; interval: number }
  | { status: 'connected'; account: MailAccountView };

export function mailConnected(account: MailAccountView | null) {
  return Boolean(
    account && (account.provider === 'outlook' ? account.hasOAuth : account.hasPassword && account.verified),
  );
}

export function parseOutlookConnect(value: unknown): OutlookConnectInput | string {
  if (!value || typeof value !== 'object') return 'Conta Outlook inválida.';
  const { user, fromName = '', clientId } = value as Record<string, unknown>;
  if (typeof user !== 'string' || user.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.trim()))
    return 'Informe o email da conta Outlook/Hotmail.';
  if (typeof fromName !== 'string' || fromName.length > 120) return 'Nome do remetente inválido.';
  if (typeof clientId !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(clientId.trim()))
    return 'Informe o Application (client) ID do aplicativo Microsoft (formato UUID).';
  return { user: user.trim(), fromName: fromName.trim(), clientId: clientId.trim() };
}
export interface MailAccountInput extends SmtpSettings {
  provider: MailProvider;
  user: string;
  fromName: string;
  /** Empty keeps the stored password. */
  password: string;
}

export function parseMailAccount(value: unknown): MailAccountInput | string {
  if (!value || typeof value !== 'object') return 'Conta inválida.';
  const v = value as Record<string, unknown>;
  if (!mailProviders.includes(v.provider as MailProvider)) return 'Provedor inválido.';
  const provider = v.provider as MailProvider;
  if (provider === 'outlook') return 'Para conectar Outlook/Hotmail, use Entrar com Microsoft.';
  const preset = provider === 'custom' ? undefined : mailPresets[provider];
  const host = preset?.host ?? v.host;
  const port = preset?.port ?? v.port;
  const secure = preset?.secure ?? v.secure;
  if (typeof host !== 'string' || !/^[a-z0-9.-]+$/i.test(host)) return 'Servidor SMTP inválido.';
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) return 'Porta inválida.';
  if (typeof secure !== 'boolean') return 'Informe se a conexão usa SSL.';
  const { user, fromName = '', password = '' } = v;
  if (typeof user !== 'string' || user.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.trim()))
    return 'Informe um email válido para a conta.';
  if (typeof fromName !== 'string' || fromName.length > 120) return 'Nome do remetente inválido.';
  if (typeof password !== 'string' || password.length > 200) return 'Senha inválida.';
  return {
    provider,
    host,
    port,
    secure,
    user: user.trim(),
    fromName: fromName.trim(),
    // App passwords are shown in groups of four separated by spaces.
    password: password.replace(/\s+/g, ''),
  };
}

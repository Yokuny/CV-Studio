import {
  type MailAccountInput,
  type MailProvider,
  mailConnected,
  mailPresets,
  type SmtpSettings,
} from '@cv-studio/core/mail';
import { Check, Copy, ExternalLink, PlugZap, Save, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { useJobs } from '@/store/jobs';
import { notify } from '@/store/notice';

const smtp = ({ host, port, secure }: SmtpSettings): SmtpSettings => ({ host, port, secure });
const blank: MailAccountInput = {
  provider: 'gmail',
  ...smtp(mailPresets.gmail),
  user: '',
  fromName: '',
  password: '',
};

const setupSteps = 'ml-4 list-decimal space-y-2 text-xs font-normal marker:text-blue-600 dark:marker:text-blue-400';
const setupLink = 'text-blue-600 hover:underline dark:text-blue-400';

function SetupLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      className={`inline-flex items-center gap-2 rounded-md ${setupLink} focus-visible:outline-2 focus-visible:outline-offset-2`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <span>{children}</span>
      <span className={buttonVariants({ variant: 'outline', size: 'icon-sm', className: 'text-foreground' })}>
        <ExternalLink aria-hidden="true" />
      </span>
    </a>
  );
}

/** Connects Outlook with Microsoft OAuth2; Gmail/custom SMTP use app passwords. */
export function MailAccountDialog() {
  const open = useJobs((s) => s.accountOpen);
  const account = useJobs((s) => s.account);
  const login = useJobs((s) => s.outlookLogin);
  const starting = useJobs((s) => s.outlookStarting);
  const outlookError = useJobs((s) => s.outlookError);
  const outlookConfigured = useJobs((s) => s.outlookConfigured);
  const {
    setAccountOpen,
    saveAccount,
    connectAccount,
    removeAccount,
    verifyAccount,
    startOutlook,
    pollOutlook,
    cancelOutlook,
  } = useJobs.getState();
  const [form, setForm] = useState<MailAccountInput>(blank);
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  useEffect(() => {
    if (!open) return;
    if (!account) setForm(blank);
    else {
      setForm({
        provider: account.provider,
        ...smtp(account),
        user: account.user,
        fromName: account.fromName,
        password: '',
      });
    }
  }, [open, account]);
  useEffect(() => {
    if (!open || !login) return;
    const timer = setTimeout(() => void pollOutlook(), login.interval * 1000);
    return () => clearTimeout(timer);
  }, [open, login, pollOutlook]);
  const preset = form.provider === 'custom' ? undefined : mailPresets[form.provider];
  const custom = !preset;
  const outlook = form.provider === 'outlook';
  const locked = busy || starting || Boolean(login);
  const setProvider = (provider: MailProvider) =>
    setForm((f) => ({ ...f, provider, password: '', ...(provider === 'custom' ? {} : smtp(mailPresets[provider])) }));
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };
  const sameAccount = account?.provider === form.provider && account.user === form.user.trim();
  const canSave = form.user.trim() && (form.password || (sameAccount && account?.hasPassword));

  return (
    <Dialog open={open} onOpenChange={setAccountOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conta de email</DialogTitle>
          <DialogDescription>
            Outlook usa login Microsoft; Gmail usa senha de app. As credenciais ficam neste computador, fora do Git, e
            não voltam para o navegador.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (outlook) {
              if (!locked) void startOutlook({ user: form.user, fromName: form.fromName });
              return;
            }
            void run(async () => (await saveAccount(form)) && setAccountOpen(false));
          }}
        >
          <div className="job-field">
            <Label htmlFor="mail-provider">Provedor</Label>
            <Select
              disabled={locked}
              value={form.provider}
              onValueChange={(value) => setProvider(value as MailProvider)}
            >
              <SelectTrigger id="mail-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail">{mailPresets.gmail.label}</SelectItem>
                <SelectItem value="outlook">{mailPresets.outlook.label}</SelectItem>
                <SelectItem value="custom">Outro servidor SMTP</SelectItem>
              </SelectContent>
            </Select>
            {form.provider !== 'gmail' && (
              <span className="small-note">
                {preset
                  ? `${preset.help} Servidor ${preset.host}:${preset.port}.`
                  : 'Informe o servidor, a porta e se a conexão usa SSL direto (465) ou STARTTLS (587).'}
              </span>
            )}
            {form.provider === 'gmail' && (
              <section aria-labelledby="gmail-setup-title" className="text-xs font-normal text-muted-foreground">
                <h3 id="gmail-setup-title" className="mb-2 text-xs font-normal">
                  Prepare sua conta Google
                </h3>
                <ol className={setupSteps}>
                  <li className="pl-1">
                    <SetupLink href="https://myaccount.google.com/signinoptions/two-step-verification">
                      Ativar verificação em duas etapas
                    </SetupLink>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ative essa proteção na conta Gmail que você deseja conectar.
                    </p>
                  </li>
                  <li className="pl-1">
                    <SetupLink href="https://myaccount.google.com/apppasswords">Criar senha de app no Google</SetupLink>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Dê o nome “CV Studio” à senha de app e copie os 16 caracteres gerados.
                    </p>
                  </li>
                  <li className="pl-1">
                    <p>Conecte sua conta abaixo</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Informe seu email, cole a senha no campo “Senha de app” e clique em “Salvar e testar”.
                    </p>
                  </li>
                </ol>
              </section>
            )}
          </div>
          {custom && (
            <div className="grid grid-cols-[1fr_90px_auto] items-end gap-2">
              <div className="job-field">
                <Label htmlFor="mail-host">Servidor SMTP</Label>
                <Input
                  id="mail-host"
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                />
              </div>
              <div className="job-field">
                <Label htmlFor="mail-port">Porta</Label>
                <Input
                  id="mail-port"
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                />
              </div>
              <Label className="h-9 gap-2">
                <input
                  type="checkbox"
                  checked={form.secure}
                  onChange={(e) => setForm((f) => ({ ...f, secure: e.target.checked }))}
                />
                SSL
              </Label>
            </div>
          )}
          <div className="job-field">
            <Label htmlFor="mail-user">Email</Label>
            <Input
              id="mail-user"
              type="email"
              autoComplete="username"
              value={form.user}
              disabled={locked}
              onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
            />
          </div>
          <div className="job-field">
            <Label htmlFor="mail-from">Nome do remetente</Label>
            <Input
              id="mail-from"
              placeholder="Como seu nome aparece para quem recebe"
              value={form.fromName}
              disabled={locked}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
            />
          </div>
          {outlook ? (
            !outlookConfigured && (
              <p role="note" className="small-note">
                Para usar Outlook, defina <code>CV_STUDIO_OUTLOOK_CLIENT_ID</code> em <code>.env.local</code>, na raiz
                do projeto, e reinicie a API. O passo a passo está em <code>docs/email-outlook.md</code>.
              </p>
            )
          ) : (
            <div className="job-field">
              <Label htmlFor="mail-password">Senha de app</Label>
              <Input
                id="mail-password"
                type="password"
                disabled={locked}
                autoComplete="new-password"
                placeholder={
                  sameAccount && account?.hasPassword ? 'Guardada — preencha só para trocar' : 'xxxx xxxx xxxx xxxx'
                }
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          )}
          {outlook && outlookError && (
            <p role="alert" className="text-sm text-destructive">
              {outlookError}
            </p>
          )}
          {outlook && login && (
            <section
              className="grid gap-2 text-xs font-normal text-muted-foreground"
              role="status"
              aria-labelledby="outlook-setup-title"
            >
              <h3 id="outlook-setup-title" className="text-xs font-normal">
                Conecte sua conta Microsoft
              </h3>
              <ol className={setupSteps}>
                <li className="pl-1">
                  <p>Copie o código</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="select-all text-sm font-normal text-foreground">{login.userCode}</code>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label={copiedCode === login.userCode ? 'Copiado' : 'Copiar código'}
                      title={copiedCode === login.userCode ? 'Copiado' : 'Copiar código'}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(login.userCode);
                          setCopiedCode(login.userCode);
                        } catch {
                          notify('Não foi possível copiar. Selecione o código e copie manualmente.');
                        }
                      }}
                    >
                      {copiedCode === login.userCode ? <Check /> : <Copy />}
                    </Button>
                  </div>
                </li>
                <li className="pl-1">
                  <SetupLink href={login.verificationUri}>Abrir login Microsoft</SetupLink>
                  <p className="mt-1">Cole o código na página Microsoft.</p>
                </li>
                <li className="pl-1">
                  <p>Autorize o CV Studio</p>
                  <p className="mt-1">
                    Entre com {form.user} e autorize o envio de emails. A conexão é confirmada automaticamente, sem
                    enviar email.
                  </p>
                </li>
              </ol>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-start font-normal"
                onClick={() => void cancelOutlook()}
              >
                Cancelar conexão
              </Button>
            </section>
          )}
          <DialogFooter className="mt-3">
            {account && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto"
                disabled={locked}
                onClick={() => void run(removeAccount)}
              >
                <Unplug /> Desconectar
              </Button>
            )}
            {outlook ? (
              <>
                {sameAccount && mailConnected(account) && (
                  <Button type="button" variant="outline" disabled={locked} onClick={() => void run(verifyAccount)}>
                    Testar conexão
                  </Button>
                )}
                <Button type="submit" disabled={locked || !form.user.trim() || !outlookConfigured}>
                  <PlugZap /> {starting ? 'Iniciando…' : 'Entrar com Microsoft'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !canSave}
                  onClick={() => void run(() => connectAccount(form))}
                >
                  <PlugZap /> Salvar e testar
                </Button>
                <Button type="submit" disabled={busy || !canSave}>
                  <Save /> Salvar
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { promises as fs } from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApi } from '../apps/api/src/app';
import type { MailOptions } from '../apps/api/src/mail';

let directory: string;
let api: ReturnType<typeof createApi>;
let server: ReturnType<ReturnType<typeof createApi>['app']['listen']>;
let origin: string;
let now: number;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
let verify: ReturnType<typeof vi.fn>;
let transport: ReturnType<typeof vi.fn>;
const input = { user: 'felipe.vni@hotmail.com', fromName: 'Felipe', clientId: '00000000-1111-2222-3333-444444444444' };
const call = (route: string, body: unknown = {}, headers: Record<string, string> = {}) =>
  fetch(`${origin}/api/mail/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-outlook-api-'));
  await fs.mkdir(path.join(directory, 'content'));
  now = 1000;
  fetcher = vi.fn<typeof fetch>();
  verify = vi.fn().mockResolvedValue(true);
  transport = vi.fn(() => ({ verify }));
  api = createApi({
    contentRoot: path.join(directory, 'content'),
    dataRoot: path.join(directory, 'data'),
    webOrigin: 'http://127.0.0.1:1',
    outlookClientId: '73fa6100-f266-408d-a19c-4964a108cea0',
    mailOptions: {
      fetch: fetcher,
      now: () => now,
      createTransport: transport as unknown as NonNullable<MailOptions['createTransport']>,
    },
  });
  server = api.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await api.close();
  await fs.rm(directory, { recursive: true, force: true });
});
it('conecta pela API sem expor tokens, respeita polling e confirma SMTP', async () => {
  fetcher
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          device_code: 'private-device',
          user_code: 'ABCD',
          verification_uri: 'https://microsoft.com/devicelogin',
          expires_in: 900,
          interval: 5,
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 3600 }),
      ),
    );
  const started = await call('outlook/start', input);
  expect(started.status).toBe(200);
  const login = await started.json();
  expect(JSON.stringify(login)).not.toContain('private-');
  expect(await (await call('outlook/poll', { sessionId: login.sessionId })).json()).toEqual({
    status: 'pending',
    interval: 5,
  });
  now += 5000;
  const connected = await call('outlook/poll', { sessionId: login.sessionId });
  expect(connected.status).toBe(200);
  expect(await connected.json()).toMatchObject({
    status: 'connected',
    account: { hasOAuth: true, hasPassword: false },
  });
  const account = await (await fetch(`${origin}/api/mail/account`)).text();
  expect(account).not.toContain('private-');
  expect(account).not.toContain('oauth');
  expect(verify).toHaveBeenCalledOnce();
});
it('protege o início de login contra outras origens, valida entradas e permite cancelar', async () => {
  expect((await call('outlook/start', input, { Origin: 'https://evil.example' })).status).toBe(403);
  expect((await call('outlook/start', { ...input, user: 'invalid' })).status).toBe(400);
  expect((await call('outlook/poll', {})).status).toBe(400);
  expect((await call('outlook/cancel', {})).status).toBe(400);
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        device_code: 'private-device',
        user_code: 'ABCD',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
      }),
    ),
  );
  const login = await (await call('outlook/start', input)).json();
  expect((await call('outlook/cancel', { sessionId: login.sessionId })).status).toBe(200);
  const cancelled = await call('outlook/poll', { sessionId: login.sessionId });
  expect(cancelled.status).toBe(502);
  expect((await cancelled.json()).error).toMatch(/cancelada/);
  expect(verify).not.toHaveBeenCalled();
});

it('conecta o Gmail pessoal informado pelo usuário com SSL e sem devolver senha', async () => {
  const connected = await call('connect', {
    provider: 'gmail',
    user: 'pessoa@gmail.com',
    fromName: 'Pessoa',
    password: 'abcd efgh ijkl mnop',
    host: 'wrong.example',
    port: 1,
    secure: false,
  });
  expect(connected.status).toBe(200);
  const account = await connected.json();
  expect(account).toMatchObject({
    user: 'pessoa@gmail.com',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    verified: true,
    hasPassword: true,
  });
  expect(account).not.toHaveProperty('password');
  expect(transport).toHaveBeenCalledWith(
    expect.objectContaining({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'pessoa@gmail.com', pass: 'abcdefghijklmnop' },
    }),
  );
  expect(verify).toHaveBeenCalledOnce();
  const stored = JSON.parse(await fs.readFile(path.join(directory, 'data/mail-account.json'), 'utf8'));
  expect(stored.password).toBe('abcdefghijklmnop');
  expect((await fs.stat(path.join(directory, 'data/mail-account.json'))).mode & 0o777).toBe(0o600);
});

it('mantém a conta anterior quando um novo login Gmail falha', async () => {
  const settings = { provider: 'gmail', user: 'primeira@gmail.com', password: 'abcdefghijklmnop' };
  await call('connect', settings);
  verify.mockRejectedValueOnce({ code: 'EAUTH', responseCode: 535 });
  const failed = await call('connect', { ...settings, user: 'outra@gmail.com', password: 'senha-incorreta' });
  expect(failed.status).toBe(502);
  expect((await failed.json()).error).toMatch(/senha de app de 16 caracteres/);
  expect(await (await fetch(`${origin}/api/mail/account`)).json()).toMatchObject({
    user: 'primeira@gmail.com',
    verified: true,
  });
  expect((await call('connect', { ...settings, user: 'invalido' })).status).toBe(400);
});

it('salvar sem testar não marca Gmail como conectado e trocar conta não reutiliza sua senha', async () => {
  const settings = { provider: 'gmail', user: 'pessoa@gmail.com', password: 'abcdefghijklmnop' };
  const saved = await fetch(`${origin}/api/mail/account`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  expect(await saved.json()).toMatchObject({ verified: false, hasPassword: true });
  expect(verify).not.toHaveBeenCalled();
  expect((await call('connect', { ...settings, user: 'outra@gmail.com', password: '' })).status).toBe(502);
  const connected = await call('connect', { ...settings, password: '' });
  expect(await connected.json()).toMatchObject({ verified: true, user: 'pessoa@gmail.com' });
});

it('usa o client ID do sistema sem pedir esse ID ao usuário ou devolvê-lo na configuração', async () => {
  const config = await (await fetch(`${origin}/api/mail/outlook/config`)).json();
  expect(config).toEqual({ configured: true });
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        device_code: 'private-device',
        user_code: 'ABCD',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
      }),
    ),
  );
  const result = await call('outlook/start', { user: input.user, fromName: input.fromName });
  expect(result.status).toBe(200);
  const body = new URLSearchParams(String(fetcher.mock.calls[0][1]?.body));
  expect(body.get('client_id')).toBe('73fa6100-f266-408d-a19c-4964a108cea0');
});

it('sem client ID no ambiente recusa o login e ignora o ID enviado pelo navegador', async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await api.close();
  vi.stubEnv('CV_STUDIO_OUTLOOK_CLIENT_ID', '');
  api = createApi({
    contentRoot: path.join(directory, 'content'),
    dataRoot: path.join(directory, 'data'),
    webOrigin: 'http://127.0.0.1:1',
    mailOptions: { fetch: fetcher, now: () => now },
  });
  vi.unstubAllEnvs();
  server = api.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  expect(await (await fetch(`${origin}/api/mail/outlook/config`)).json()).toEqual({ configured: false });
  const result = await call('outlook/start', input);
  expect(result.status).toBe(400);
  expect((await result.json()).error).toMatch(/\.env\.local/);
  expect(fetcher).not.toHaveBeenCalled();
});

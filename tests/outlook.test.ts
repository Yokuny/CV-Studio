import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mailConnected, parseMailAccount, parseOutlookConnect } from '@cv-studio/core/mail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MailOptions, mailAccount, mailError } from '../apps/api/src/mail';
import { outlookOAuth } from '../apps/api/src/outlook-oauth';

const input = { user: 'felipe.vni@hotmail.com', fromName: 'Felipe', clientId: '00000000-1111-2222-3333-444444444444' };
const device = {
  device_code: 'private-device-code',
  user_code: 'USER-CODE',
  verification_uri: 'https://microsoft.com/devicelogin',
  expires_in: 900,
  interval: 5,
};
const token = { access_token: 'private-access-token', refresh_token: 'private-refresh-token', expires_in: 3600 };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let dir: string;
let now: number;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
let verify: ReturnType<typeof vi.fn>;
let sendMail: ReturnType<typeof vi.fn>;
let createTransport: ReturnType<typeof vi.fn>;
let mail: ReturnType<typeof mailAccount>;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-outlook-'));
  now = 100000;
  fetcher = vi.fn<typeof fetch>();
  verify = vi.fn().mockResolvedValue(true);
  sendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' });
  createTransport = vi.fn(() => ({ verify, sendMail }));
  mail = mailAccount(dir, {
    fetch: fetcher,
    now: () => now,
    createTransport: createTransport as unknown as NonNullable<MailOptions['createTransport']>,
  });
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function connect() {
  fetcher.mockResolvedValueOnce(response(device)).mockResolvedValueOnce(response(token));
  const login = await mail.startOutlook(input);
  now += 5000;
  const result = await mail.pollOutlook(login.sessionId);
  expect(result.status).toBe('connected');
  return result;
}

const message = {
  to: 'test@example.com',
  toName: 'Test',
  subject: 'SMTP test',
  text: 'Pitch',
  attachment: { filename: 'cv.pdf', content: Buffer.from('%PDF-1.4') },
};

describe('Outlook OAuth2', () => {
  it('valida client ID e usa login Microsoft em vez de senha de app', () => {
    expect(parseOutlookConnect(input)).toEqual(input);
    expect(parseOutlookConnect({ ...input, clientId: 'wrong' })).toMatch(/client.*ID/);
    expect(parseOutlookConnect({ ...input, user: 'not-email' })).toMatch(/email/);
    expect(parseMailAccount({ provider: 'outlook', user: input.user, password: 'unused' })).toMatch(
      /Entrar com Microsoft/,
    );
  });

  it('pede só SMTP.Send e offline_access e mantém device_code na API', async () => {
    fetcher.mockImplementation(async () => response(device));
    const login = await mail.startOutlook(input);
    expect(login).toMatchObject({ userCode: 'USER-CODE', interval: 5 });
    expect(JSON.stringify(login)).not.toContain('private-device-code');
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode');
    const body = new URLSearchParams(String(request?.body));
    expect(body.get('scope')).toBe('https://outlook.office.com/SMTP.Send offline_access');
    expect(body.get('client_id')).toBe(input.clientId);
    expect(body.has('client_secret')).toBe(false);
  });

  it('respeita o intervalo e slow_down até a autorização ser concluída', async () => {
    fetcher
      .mockResolvedValueOnce(response(device))
      .mockResolvedValueOnce(response({ error: 'authorization_pending' }, 400))
      .mockResolvedValueOnce(response({ error: 'slow_down' }, 400))
      .mockResolvedValueOnce(response(token));
    const login = await mail.startOutlook(input);
    expect(await mail.pollOutlook(login.sessionId)).toEqual({ status: 'pending', interval: 5 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 5000;
    expect(await mail.pollOutlook(login.sessionId)).toEqual({ status: 'pending', interval: 5 });
    now += 5000;
    expect(await mail.pollOutlook(login.sessionId)).toEqual({ status: 'pending', interval: 10 });
    now += 5000;
    await mail.pollOutlook(login.sessionId);
    expect(fetcher).toHaveBeenCalledTimes(3);
    now += 5000;
    expect((await mail.pollOutlook(login.sessionId)).status).toBe('connected');
  });

  it('confirma SMTP OAuth2 antes de guardar tokens e não os devolve à UI', async () => {
    const result = await connect();
    expect(result).toMatchObject({ account: { hasPassword: false, hasOAuth: true, user: input.user } });
    expect(JSON.stringify(result)).not.toContain('private-');
    expect(JSON.stringify(await mail.view())).not.toContain('private-');
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp-mail.outlook.com',
        port: 587,
        requireTLS: true,
        auth: { type: 'OAuth2', user: input.user, accessToken: token.access_token },
      }),
    );
    expect(verify).toHaveBeenCalledOnce();
    expect(sendMail).not.toHaveBeenCalled();
    const stored = JSON.parse(await fs.readFile(path.join(dir, 'mail-account.json'), 'utf8'));
    expect(stored.oauth.refreshToken).toBe(token.refresh_token);
    expect(stored.password).toBe('');
    expect((await fs.stat(path.join(dir, 'mail-account.json'))).mode & 0o777).toBe(0o600);
    expect(await fs.readdir(dir)).toEqual(['mail-account.json']);
    expect(mailConnected(await mail.view())).toBe(true);
  });

  it('renova o token após reabrir o app e persiste a rotação antes de enviar', async () => {
    await connect();
    now += 3600000;
    fetcher.mockResolvedValueOnce(response({ ...token, access_token: 'new-access', refresh_token: 'new-refresh' }));
    const reopened = mailAccount(dir, {
      fetch: fetcher,
      now: () => now,
      createTransport: createTransport as unknown as NonNullable<MailOptions['createTransport']>,
    });
    expect(await reopened.send(message)).toBe('test-message-id');
    const request = new URLSearchParams(String(fetcher.mock.calls[2][1]?.body));
    expect(request.get('grant_type')).toBe('refresh_token');
    expect(request.get('refresh_token')).toBe(token.refresh_token);
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ auth: { type: 'OAuth2', user: input.user, accessToken: 'new-access' } }),
    );
    const stored = JSON.parse(await fs.readFile(path.join(dir, 'mail-account.json'), 'utf8'));
    expect(stored.oauth.refreshToken).toBe('new-refresh');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [expect.objectContaining({ contentType: 'application/pdf' })] }),
    );
  });

  it('compartilha a renovação entre operações simultâneas e preserva refresh token omitido', async () => {
    await connect();
    now += 3600000;
    fetcher.mockResolvedValueOnce(response({ access_token: 'new-access', expires_in: 3600 }));
    await Promise.all([mail.verify(), mail.verify()]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect((await mail.load())?.oauth?.refreshToken).toBe(token.refresh_token);
  });

  it('solicita novo login quando a autorização é revogada sem vazar a resposta Microsoft', async () => {
    await connect();
    now += 3600000;
    fetcher.mockResolvedValueOnce(response({ error: 'invalid_grant', error_description: 'private-response' }, 400));
    const error = await mail.send(message).catch((e) => e);
    expect(mailError(error, 'outlook')).toMatch(/revogada/);
    expect(mailError(error, 'outlook')).not.toContain('private-response');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('preserva a conta anterior se o SMTP rejeitar a conta autorizada', async () => {
    await mail.save({
      provider: 'gmail',
      user: 'old@gmail.com',
      fromName: '',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      password: 'old-password',
    });
    verify.mockRejectedValueOnce({ code: 'EAUTH', responseCode: 535 });
    fetcher.mockResolvedValueOnce(response(device)).mockResolvedValueOnce(response(token));
    const login = await mail.startOutlook(input);
    now += 5000;
    await expect(mail.pollOutlook(login.sessionId)).rejects.toMatchObject({ code: 'EAUTH' });
    expect(await mail.view()).toMatchObject({ provider: 'gmail', hasPassword: true });
  });

  it('cancela sessões, expira códigos e não restaura credenciais após desconectar', async () => {
    fetcher.mockImplementation(async () => response(device));
    const first = await mail.startOutlook(input);
    await mail.cancelOutlook(first.sessionId);
    await expect(mail.pollOutlook(first.sessionId)).rejects.toThrow(/cancelada/);
    const second = await mail.startOutlook(input);
    now = second.expiresAt;
    await expect(mail.pollOutlook(second.sessionId)).rejects.toThrow(/expirou/);
    const third = await mail.startOutlook(input);
    await mail.remove();
    await expect(mail.pollOutlook(third.sessionId)).rejects.toThrow(/cancelada/);
    expect(await mail.view()).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('encerra o login quando o usuário nega a autorização', async () => {
    fetcher
      .mockResolvedValueOnce(response(device))
      .mockResolvedValueOnce(response({ error: 'authorization_declined' }, 400));
    const login = await mail.startOutlook(input);
    now += 5000;
    await expect(mail.pollOutlook(login.sessionId)).rejects.toThrow(/recusada/);
    await expect(mail.pollOutlook(login.sessionId)).rejects.toThrow(/cancelada/);
    expect(await mail.view()).toBeNull();
  });

  it('não grava credenciais se a conexão for cancelada durante a confirmação SMTP', async () => {
    let completeVerify: () => void = () => {};
    let startedVerify: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      startedVerify = resolve;
    });
    verify.mockImplementationOnce(() => {
      startedVerify();
      return new Promise<void>((resolve) => {
        completeVerify = resolve;
      });
    });
    fetcher.mockResolvedValueOnce(response(device)).mockResolvedValueOnce(response(token));
    const login = await mail.startOutlook(input);
    now += 5000;
    const polling = mail.pollOutlook(login.sessionId);
    const rejected = expect(polling).rejects.toThrow(/cancelada/);
    await started;
    const cancellation = mail.cancelOutlook(login.sessionId);
    completeVerify();
    await rejected;
    await cancellation;
    expect(await mail.view()).toBeNull();
  });

  it('não considera conectada uma conta Outlook antiga com senha de aplicativo', async () => {
    await fs.writeFile(
      path.join(dir, 'mail-account.json'),
      JSON.stringify({ provider: 'outlook', user: input.user, password: 'old-password' }),
    );
    expect(mailConnected(await mail.view())).toBe(false);
    expect((await mail.view())?.hasPassword).toBe(false);
    await expect(mail.verify()).rejects.toThrow(/Entrar com Microsoft/);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('rejeita respostas inválidas e links fora da Microsoft', async () => {
    const oauth = outlookOAuth(fetcher);
    fetcher.mockResolvedValueOnce(response({ ...device, verification_uri: 'https://fake.example' }));
    await expect(oauth.start(input.clientId)).rejects.toThrow(/inválida/);
    fetcher.mockResolvedValueOnce(response({ access_token: 'private', expires_in: 3600 }));
    await expect(oauth.poll(input.clientId, 'device')).rejects.toThrow(/inválida/);
    fetcher.mockResolvedValueOnce(response({ error: 'unauthorized_client', error_description: 'private' }, 400));
    await expect(oauth.start(input.clientId)).rejects.toThrow(/fluxos de cliente público/);
  });
});

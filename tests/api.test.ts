import { promises as fs } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { defaultLayout } from '@cv-studio/core/model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi } from '../apps/api/src/app';
import { openDatabase } from '../apps/api/src/db';
import { mailError } from '../apps/api/src/mail';
import { resumeFiles } from '../apps/api/src/repository';

let dir: string;
let base: string;
let close: () => Promise<void>;
let pdfError: Error | undefined;
const call = (route: string, init: RequestInit & { json?: unknown } = {}) =>
  fetch(`${base}/api/${route}`, {
    ...init,
    headers: { ...(init.json === undefined ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
    body: init.json === undefined ? init.body : JSON.stringify(init.json),
  });

beforeEach(async () => {
  pdfError = undefined;
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cv-api-')));
  const contentRoot = path.join(dir, 'content');
  await fs.mkdir(contentRoot);
  await resumeFiles(contentRoot).write({
    id: 'base',
    name: 'Currículo base',
    markdown: '# Felipe\n',
    layout: defaultLayout,
  });
  await fs.writeFile(path.join(contentRoot, 'base.pitch.md'), 'Olá, {{recrutadora}}! Vaga {{cargo}}. {{nome}}');
  const api = createApi({
    contentRoot,
    dataRoot: path.join(dir, 'data'),
    webOrigin: 'http://127.0.0.1:1',
    renderPdf: async () => {
      if (pdfError) throw pdfError;
      return Buffer.from('%PDF-1.4');
    },
  });
  const server = api.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = async () => {
    server.close();
    await api.close();
  };
});
afterEach(async () => {
  await close();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('API local', () => {
  it('explica a exigência de OAuth2 no Outlook sem culpar a senha', () => {
    expect(mailError({ code: 'EAUTH', responseCode: 535 }, 'outlook')).toMatch(/Entre com Microsoft novamente/);
    expect(mailError({ code: 'EAUTH' }, 'gmail')).toMatch(/senha de app de 16 caracteres/);
    expect(mailError({ code: 'ETIMEDOUT' }, 'outlook')).toMatch(/conectar ao servidor SMTP/);
  });

  it('registra falha de PDF no histórico e mantém a vaga em rascunho', async () => {
    const job = await (
      await call('jobs', {
        method: 'POST',
        json: { company: 'Teste', role: 'Backend', recruiterName: 'Felipe', recruiterEmail: 'teste@example.com' },
      })
    ).json();
    pdfError = new Error('Chromium indisponível');
    const sent = await call(`jobs/${job.id}/send`, { method: 'POST', json: {} });
    expect(sent.status).toBe(502);
    expect(await (await call(`jobs/${job.id}/emails`)).json()).toEqual([
      expect.objectContaining({ error: 'Chromium indisponível', messageId: null }),
    ]);
    expect((await (await call('jobs')).json())[0].status).toBe('rascunho');
  });

  it('envia assunto, pitch e PDF por SMTP e atualiza status e histórico', async () => {
    let message = '';
    const smtp = createServer((socket) => {
      socket.setEncoding('utf8');
      socket.write('220 localhost test SMTP\r\n');
      let input = '';
      let data = false;
      socket.on('data', (chunk) => {
        input += chunk;
        while (input.includes('\r\n')) {
          const end = input.indexOf('\r\n');
          const line = input.slice(0, end);
          input = input.slice(end + 2);
          if (data) {
            if (line === '.') {
              data = false;
              socket.write('250 accepted\r\n');
            } else message += `${line}\r\n`;
          } else if (line.startsWith('EHLO')) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
          else if (line.startsWith('AUTH PLAIN')) socket.write('235 authenticated\r\n');
          else if (line === 'DATA') {
            data = true;
            socket.write('354 send data\r\n');
          } else if (line === 'QUIT') socket.end('221 bye\r\n');
          else socket.write('250 OK\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => smtp.listen(0, '127.0.0.1', resolve));
    try {
      await call('mail/account', {
        method: 'PUT',
        json: {
          provider: 'custom',
          host: '127.0.0.1',
          port: (smtp.address() as AddressInfo).port,
          secure: false,
          user: 'teste@example.com',
          password: 'local-only',
        },
      });
      expect((await call('mail/verify', { method: 'POST', json: {} })).status).toBe(200);
      expect(message).toBe('');
      const job = await (
        await call('jobs', {
          method: 'POST',
          json: {
            company: 'Teste',
            role: 'Backend',
            recruiterName: 'Felipe',
            recruiterEmail: 'destino@example.com',
            subject: 'Teste CV Studio',
          },
        })
      ).json();
      const sent = await call(`jobs/${job.id}/send`, { method: 'POST', json: {} });
      expect(sent.status).toBe(200);
      expect((await sent.json()).job).toMatchObject({ status: 'enviado', appliedAt: expect.any(String) });
      expect(message).toContain('To: Felipe <destino@example.com>');
      expect(message).toContain('Subject: Teste CV Studio');
      expect(message).toContain('Backend. Felipe');
      expect(message).not.toContain('{{');
      expect(message).toContain('Content-Type: application/pdf');
      expect(message).toContain(Buffer.from('%PDF-1.4').toString('base64'));
      expect(await (await call(`jobs/${job.id}/emails`)).json()).toEqual([
        expect.objectContaining({ error: null, messageId: expect.any(String), subject: 'Teste CV Studio' }),
      ]);
    } finally {
      await new Promise<void>((resolve, reject) => smtp.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('recusa outras origens e corpos que não são JSON', async () => {
    expect((await call('jobs', { method: 'POST', json: {}, headers: { Origin: 'https://evil.example' } })).status).toBe(
      403,
    );
    expect((await call('jobs', { method: 'POST', body: 'company=x' })).status).toBe(415);
    // fetch cannot set Host, which DNS rebinding would change; send it with node:http.
    const status = await new Promise((resolve) =>
      request(`${base}/api/jobs`, { headers: { Host: 'evil.example' } }, (res) => resolve(res.statusCode)).end(),
    );
    expect(status).toBe(403);
  });

  it('cadastra vagas, monta o email e exporta/importa CSV', async () => {
    const created = await call('jobs', {
      method: 'POST',
      json: { company: 'Acme, "SA"', role: 'Backend', recruiterName: 'Ana', recruiterEmail: 'ana@acme.com' },
    });
    expect(created.status).toBe(201);
    const job = await created.json();
    expect((await call('jobs', { method: 'POST', json: { company: 'X' } })).status).toBe(400);

    const preview = await (await call(`jobs/${job.id}/preview`)).json();
    expect(preview).toMatchObject({
      to: 'ana@acme.com',
      subject: 'Candidatura — Backend',
      body: 'Olá, Ana! Vaga Backend. Felipe',
      attachment: 'Currículo - Felipe.pdf',
      problems: [],
    });
    // Without an SMTP account the send fails and is recorded in the history.
    const send = await call(`jobs/${job.id}/send`, { method: 'POST', json: {} });
    expect(send.status).toBe(502);
    const [attempt] = await (await call(`jobs/${job.id}/emails`)).json();
    expect(attempt.error).toMatch(/Conecte uma conta/);

    const csv = await (await call('jobs/export.csv')).text();
    expect(csv).toContain('"Acme, ""SA"""');
    const imported = await call('jobs/import', { method: 'POST', json: { csv } });
    expect(await imported.json()).toEqual({ imported: 1 });
    const jobs = await (await call('jobs')).json();
    expect(jobs.map((j: { company: string }) => j.company)).toEqual(['Acme, "SA"', 'Acme, "SA"']);
    const invalid = await call('jobs/import', { method: 'POST', json: { csv: 'company,role\nSó empresa,\n' } });
    expect((await invalid.json()).error).toMatch(/Linha 2/);
  });

  it('grava pitch com controle de conflito', async () => {
    const pitch = await (await call('pitches/base')).json();
    expect((await call('pitches/base', { method: 'PUT', json: { text: 'novo', expectedRevision: null } })).status).toBe(
      409,
    );
    const saved = await call('pitches/base', {
      method: 'PUT',
      json: { text: 'novo', expectedRevision: pitch.revision },
    });
    expect(saved.status).toBe(200);
    expect(
      (await call('pitches/nao-existe', { method: 'PUT', json: { text: 'x', expectedRevision: null } })).status,
    ).toBe(404);
  });

  it('guarda a senha de app sem devolvê-la', async () => {
    const saved = await call('mail/account', {
      method: 'PUT',
      json: { provider: 'gmail', user: 'eu@gmail.com', password: 'abcd efgh ijkl mnop' },
    });
    expect(await saved.json()).toMatchObject({ host: 'smtp.gmail.com', port: 465, hasPassword: true });
    const stored = JSON.parse(await fs.readFile(path.join(dir, 'data/mail-account.json'), 'utf8'));
    expect(stored.password).toBe('abcdefghijklmnop');
    expect((await fs.stat(path.join(dir, 'data/mail-account.json'))).mode & 0o777).toBe(0o600);
    // Saving again without a password keeps the stored one.
    await call('mail/account', { method: 'PUT', json: { provider: 'gmail', user: 'eu@gmail.com', fromName: 'Eu' } });
    expect(JSON.parse(await fs.readFile(path.join(dir, 'data/mail-account.json'), 'utf8')).password).toBe(
      'abcdefghijklmnop',
    );
  });
});

describe('banco de dados', () => {
  it('migra uma vez e reabre os dados', async () => {
    const dataRoot = path.join(dir, 'db');
    const first = openDatabase(dataRoot);
    first.createJob({
      company: 'A',
      role: 'B',
      recruiterName: '',
      recruiterEmail: '',
      jobUrl: '',
      source: '',
      resumeId: 'base',
      subject: '',
      status: 'rascunho',
      notes: '',
      appliedAt: null,
    });
    first.close();
    const second = openDatabase(dataRoot);
    expect(second.listJobs()).toHaveLength(1);
    second.close();
    expect((await fs.readdir(dataRoot)).sort()).toEqual(['cv-studio.db']);
  });
});

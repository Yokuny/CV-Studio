import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../apps/api/src/db';

const repoRoot = path.resolve(import.meta.dirname, '..');
let dataDir: string;
let contentDir: string;
// Runs `pnpm cv` against a temporary content/cv and jobs database: the user's files are personal and ignored by Git.
const cv = (...args: string[]) =>
  spawnSync(path.join(repoRoot, 'node_modules/.bin/tsx'), ['apps/api/scripts/cv.ts', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, CV_STUDIO_DATA_DIR: dataDir, CV_STUDIO_CONTENT_DIR: contentDir },
    timeout: 60000,
  });

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-cli-'));
  contentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-content-'));
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
  await fs.rm(contentDir, { recursive: true, force: true });
});

describe('pnpm cv init', () => {
  it('cria o base a partir do modelo uma única vez', async () => {
    expect(cv('list').stdout).toMatch(/pnpm cv init/);
    expect(cv('new', 'backend', '--name', 'Backend').stderr).toMatch(/pnpm cv init/);
    expect(cv('init').status).toBe(0);
    expect((await fs.readdir(contentDir)).sort()).toEqual([
      'base.layout.json',
      'base.md',
      'base.meta.json',
      'base.pitch.md',
    ]);
    expect(cv('check', 'base').status).toBe(0);
    expect(cv('init').stderr).toMatch(/já existe/);
    expect(cv('new', 'backend', '--name', 'Backend').status).toBe(0);
    expect(cv('list').stdout).toMatch(/backend +Backend/);
  });

  it('importa um Markdown existente', async () => {
    const file = path.join(contentDir, '..', `${path.basename(contentDir)}-cv.md`);
    await fs.writeFile(file, '# Ana Souza\n\nBackend\n');
    try {
      expect(cv('init', '--file', file).status).toBe(0);
      expect(await fs.readFile(path.join(contentDir, 'base.md'), 'utf8')).toBe('# Ana Souza\n\nBackend\n');
    } finally {
      await fs.rm(file, { force: true });
    }
  });
});

describe('pnpm cv job', () => {
  beforeEach(() => {
    cv('init');
  });

  it('cadastra a vaga como rascunho e valida os campos', () => {
    const missing = cv('job', 'add', '--resume', 'base', '--company', 'Acme');
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/Informe o cargo/);
    // The company is optional; a pitch that uses {{empresa}} stays blocked until it is filled.
    expect(cv('job', 'add', '--resume', 'base', '--role', 'Sem empresa').status).toBe(0);
    const unknown = cv('job', 'add', '--resume', 'nao-existe', '--company', 'Acme', '--role', 'Backend');
    expect(unknown.stderr).toMatch(/não existe em content\/cv/);

    const added = cv('job', 'add', '--resume', 'base', '--company', 'Acme', '--role', 'Backend', '--email', 'a@b.co');
    expect(added.status).toBe(0);
    expect(added.stdout).toMatch(/#2 {2}Backend — Acme {2}\[Rascunho\]/);
    const updated = cv('job', 'update', '2', '--recruiter', 'Ana');
    expect(updated.status).toBe(0);
    const db = openDatabase(dataDir);
    expect(db.getJob(2)).toMatchObject({ recruiterName: 'Ana', recruiterEmail: 'a@b.co', status: 'rascunho' });
    db.close();
  });

  it('não envia sem --yes nem sem conta conectada', () => {
    cv('job', 'add', '--resume', 'base', '--company', 'Acme', '--role', 'Backend', '--email', 'a@b.co');
    const preview = cv('job', 'send', '1');
    expect(preview.status).toBe(2);
    expect(preview.stdout).toMatch(/Para: {4}a@b\.co/);
    expect(preview.stdout).toMatch(/Nada foi enviado/);
    const blocked = cv('job', 'send', '1', '--yes');
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toMatch(/Envio bloqueado: .*Conecte uma conta/);
    const db = openDatabase(dataDir);
    expect(db.listEmails(1)).toEqual([]);
    db.close();
  });
});

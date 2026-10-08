import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultLayout } from '@cv-studio/core/model';
import { defaultPitch, renderTemplate, resumeName } from '@cv-studio/core/pitch';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkPitch } from '../apps/api/src/check';
import { resumeFiles } from '../apps/api/src/repository';

describe('renderTemplate', () => {
  it('preenche variáveis e mantém visíveis as desconhecidas ou vazias', () => {
    const result = renderTemplate('Olá, {{ recrutadora }}! {{cargo}} na {{empresa}} {{salario}}', {
      recrutadora: 'Ana',
      cargo: 'Backend',
      empresa: '  ',
    });
    expect(result.text).toBe('Olá, Ana! Backend na {{empresa}} {{salario}}');
    expect(result.missing).toEqual(['empresa']);
    expect(result.unknown).toEqual(['salario']);
  });
  it('lê o nome do H1', () => {
    expect(resumeName('# Felipe Rangel Ribeiro\n\n## Resumo')).toBe('Felipe Rangel Ribeiro');
  });
  it('aponta variáveis desconhecidas e o trecho de exemplo', () => {
    const issues = checkPitch(`${defaultPitch}{{empresaa}}`, 'x.pitch.md');
    expect(issues.map((i) => i.level)).toEqual(['erro', 'aviso']);
  });
});

describe('pitches em content/cv', () => {
  let root: string;
  const files = () => resumeFiles(root);
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cv-pitch-')));
    await files().write({ id: 'base', name: 'Currículo base', markdown: '# Nome\n', layout: defaultLayout });
  });
  afterEach(() => fs.rm(root, { recursive: true, force: true }));

  it('copia o pitch da origem e o remove com a versão', async () => {
    await files().writePitch('base', 'Pitch base {{cargo}}');
    await files().copy('base', 'vaga', 'Vaga');
    expect(await files().readPitch('vaga')).toBe('Pitch base {{cargo}}');
    await files().remove('vaga');
    expect(await files().readPitch('vaga')).toBeUndefined();
    expect(await files().effectivePitch('vaga')).toBe('Pitch base {{cargo}}');
  });

  it('mantém o base e os pitches mais recentes', async () => {
    await files().writePitch('base', 'base');
    for (const [i, id] of ['a', 'b', 'c', 'd'].entries()) {
      await files().writePitch(id, id);
      const time = new Date(Date.now() - (10 - i) * 1000);
      await fs.utimes(path.join(root, `${id}.pitch.md`), time, time);
    }
    expect(await files().prunePitches(2)).toEqual(['b', 'a']);
    const left = (await fs.readdir(root)).filter((f) => f.endsWith('.pitch.md')).sort();
    expect(left).toEqual(['base.pitch.md', 'c.pitch.md', 'd.pitch.md']);
    // The pitch just written is never the one pruned, whatever its mtime.
    expect(await files().prunePitches(1, 'c')).toEqual(['d']);
  });
});

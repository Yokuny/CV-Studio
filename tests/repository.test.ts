import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultLayout } from '@cv-studio/core/model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkMarkdown, checkVersions } from '../apps/api/src/check';
import { resumeFiles, revision } from '../apps/api/src/repository';
import { mergeDisk, snapshot, type Version } from '../apps/web/src/lib/repository';

const version = (id: string, markdown: string, rev: string | null = `r-${markdown}`): Version => ({
  id,
  name: id,
  markdown,
  layout: defaultLayout,
  revision: rev,
});
const savedOf = (...versions: Version[]) => Object.fromEntries(versions.map((v) => [v.id, snapshot(v)]));

describe('sincronização das abas com content/cv', () => {
  it('abre arquivos novos e atualiza abas sem edições pendentes', () => {
    const base = version('base', '# A');
    const merged = mergeDisk([base], savedOf(base), [version('base', '# B'), version('vaga', '# V')]);
    expect(merged.versions.map((v) => [v.id, v.markdown])).toEqual([
      ['base', '# B'],
      ['vaga', '# V'],
    ]);
    expect(merged.conflicts).toEqual([]);
    expect(merged.saved.base).toBe(snapshot(version('base', '# B')));
  });
  it('fecha a aba limpa cujo arquivo foi removido e mantém versões ainda não gravadas', () => {
    const gone = version('gone', '# G');
    const creating = version('nova', '# N', null);
    const merged = mergeDisk([gone, creating], savedOf(gone), []);
    expect(merged.versions.map((v) => v.id)).toEqual(['nova']);
    expect(merged.saved).not.toHaveProperty('gone');
  });
  it('preserva edições pendentes e aponta conflito quando o arquivo mudou', () => {
    const stored = version('vaga', '# Disco antigo');
    const edited = { ...stored, markdown: '# Minha edição' };
    const merged = mergeDisk([edited], savedOf(stored), [version('vaga', '# Disco novo')]);
    expect(merged.versions[0].markdown).toBe('# Minha edição');
    expect(merged.conflicts).toEqual(['vaga']);
  });
  it('não aponta conflito quando o disco já contém a edição local', () => {
    const stored = version('vaga', '# Antigo');
    const edited = { ...stored, markdown: '# Igual' };
    const merged = mergeDisk([edited], savedOf(stored), [version('vaga', '# Igual', 'r-novo')]);
    expect(merged.conflicts).toEqual([]);
    expect(merged.versions[0].revision).toBe('r-novo');
    expect(merged.saved.vaga).toBe(snapshot(edited));
  });
});

describe('arquivos usados pelo CLI e pela API local', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cv-studio-')));
    await fs.writeFile(path.join(root, 'base.md'), '# Felipe\n\nSubtítulo\n\n## Resumo\n');
    await fs.writeFile(path.join(root, 'base.layout.json'), JSON.stringify({ ...defaultLayout, fontSize: 11 }));
  });
  afterEach(() => fs.rm(root, { recursive: true, force: true }));

  it('copia Markdown e layout da origem e grava meta só com o nome', async () => {
    const files = resumeFiles(root);
    expect(await files.verifyRoot()).toBe(true);
    const created = await files.copy('base', 'backend-node', ' Backend Node ');
    expect(await fs.readFile(path.join(root, 'backend-node.md'), 'utf8')).toBe('# Felipe\n\nSubtítulo\n\n## Resumo\n');
    expect(JSON.parse(await fs.readFile(path.join(root, 'backend-node.layout.json'), 'utf8')).fontSize).toBe(11);
    expect(JSON.parse(await fs.readFile(path.join(root, 'backend-node.meta.json'), 'utf8'))).toEqual({
      name: 'Backend Node',
    });
    expect((await files.ids()).sort()).toEqual(['backend-node', 'base']);
    expect(files.matches(await files.find('backend-node'), revision(created))).toBe(true);
    expect(files.matches(await files.find('inexistente'), null)).toBe(true);
    await expect(files.copy('base', 'backend-node', 'Outra')).rejects.toThrow('Já existe');
    await expect(files.copy('base', '../fora', 'Fora')).rejects.toThrow('slug');
    await files.remove('backend-node');
    expect(await files.ids()).toEqual(['base']);
  });
  it('aponta HTML, H1 duplicado, meta legado e nomes fora do padrão', async () => {
    expect(checkMarkdown('# Nome\n\n```html\n<div>ok</div>\n```\n\n`<b>` e <https://x.dev>', 'a.md')).toEqual([]);
    expect(checkMarkdown('# A\n\n# B', 'a.md').map((i) => i.level)).toEqual(['erro']);
    expect(checkMarkdown('# A\n\n<script>x</script>', 'a.md')[0].message).toContain('HTML');
    await fs.writeFile(path.join(root, 'vaga.md'), '# Felipe');
    await fs.writeFile(path.join(root, 'vaga.layout.json'), JSON.stringify({ ...defaultLayout, fontSize: 99 }));
    await fs.writeFile(path.join(root, 'vaga.meta.json'), JSON.stringify({ name: 'Vaga', job: 'Antigo' }));
    await fs.writeFile(path.join(root, 'base copy.md'), '# Felipe');
    const issues = await checkVersions(root);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'erro', file: 'vaga.layout.json' }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'aviso', file: 'vaga.meta.json' }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'aviso', file: 'base copy.md' }));
    expect(await checkVersions(root, 'base')).toEqual([]);
    expect(await checkVersions(root, 'nada')).toEqual([expect.objectContaining({ level: 'erro' })]);
  });
});

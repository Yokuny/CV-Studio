import { promises as fs } from 'node:fs';
import path from 'node:path';
import { defaultLayout, validLayout, validResume } from '@cv-studio/core/model';
import { maxPitchLength, pitchTodo, unknownVariables } from '@cv-studio/core/pitch';
import { companions, pitchExt, slugPattern } from './repository';

export interface Issue {
  level: 'erro' | 'aviso';
  file: string;
  message: string;
}

/** Lines outside fenced code blocks, with inline code removed. */
function prose(markdown: string) {
  let fenced = false;
  return markdown.split('\n').flatMap((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return [];
    }
    return fenced ? [] : [line.replace(/`[^`]*`/g, '')];
  });
}

export function checkMarkdown(markdown: string, file: string): Issue[] {
  const issues: Issue[] = [];
  const lines = prose(markdown);
  const h1 = lines.filter((line) => /^#\s/.test(line)).length;
  if (h1 !== 1) issues.push({ level: 'erro', file, message: `Use exatamente um H1 (o nome); encontrados ${h1}.` });
  if (!/^#\s/.test(lines.find((line) => line.trim()) ?? ''))
    issues.push({ level: 'aviso', file, message: 'O arquivo deve começar pelo H1 com o nome.' });
  if (lines.some((line) => /<\/?[a-z!][^>]*>/i.test(line.replace(/<(https?:|mailto:)[^>]*>/g, ''))))
    issues.push({ level: 'erro', file, message: 'HTML bruto não é renderizado; use apenas Markdown/GFM.' });
  if (lines.some((line) => /^#{4,}\s/.test(line)))
    issues.push({ level: 'aviso', file, message: 'Prefira H2 para seções e H3 para experiências.' });
  if (markdown.length > 250000) issues.push({ level: 'erro', file, message: 'Markdown acima de 250000 caracteres.' });
  return issues;
}

export function checkPitch(text: string, file: string): Issue[] {
  const issues: Issue[] = [];
  if (text.length > maxPitchLength)
    issues.push({ level: 'erro', file, message: `Pitch acima de ${maxPitchLength} caracteres.` });
  if (/<\/?[a-z!][^>]*>/i.test(text))
    issues.push({ level: 'aviso', file, message: 'O pitch vai como texto puro; tags HTML aparecem literalmente.' });
  const unknown = unknownVariables(text);
  if (unknown.length)
    issues.push({
      level: 'erro',
      file,
      message: `Variáveis desconhecidas: ${unknown.map((v) => `{{${v}}}`).join(', ')}. Use {{empresa}}, {{cargo}}, {{recrutadora}} ou {{nome}}.`,
    });
  if (text.includes(pitchTodo))
    issues.push({ level: 'aviso', file, message: 'Ainda contém o trecho de exemplo "[Escreva aqui…]".' });
  return issues;
}

/** Validates the files of one version, or of every version in content/cv when no id is given. */
export async function checkVersions(root: string, only?: string): Promise<Issue[]> {
  const entries = await fs.readdir(root);
  const issues: Issue[] = [];
  const ids = new Set<string>();
  for (const file of entries) {
    if (file.endsWith(`.${pitchExt}`)) {
      const id = file.slice(0, -pitchExt.length - 1);
      if (only && id !== only) continue;
      if (!slugPattern.test(id)) {
        issues.push({ level: 'aviso', file, message: 'Nome fora do padrão <slug>.pitch.md; a interface ignora.' });
        continue;
      }
      if (id !== 'base' && !entries.includes(`${id}.md`))
        issues.push({ level: 'aviso', file, message: 'Pitch sem o Markdown da versão; não será usado.' });
      issues.push(...checkPitch(await fs.readFile(path.join(root, file), 'utf8'), file));
      continue;
    }
    const ext = companions.find((ext) => file.endsWith(`.${ext}`));
    const id = ext ? file.slice(0, -ext.length - 1) : undefined;
    if (id && only && id !== only) continue;
    if (!ext || !id || !slugPattern.test(id)) {
      if (!only) issues.push({ level: 'aviso', file, message: 'Nome fora do padrão <slug>.md; a interface ignora.' });
      continue;
    }
    ids.add(id);
  }
  if (only && !ids.has(only)) return [{ level: 'erro', file: `${only}.md`, message: 'Versão não encontrada.' }];
  for (const id of ids) {
    const read = (ext: string) => fs.readFile(path.join(root, `${id}.${ext}`), 'utf8').catch(() => undefined);
    const [markdown, layoutText, metaText] = await Promise.all(companions.map(read));
    if (markdown === undefined) {
      issues.push({ level: 'erro', file: `${id}.md`, message: 'Arquivos de layout/meta sem o Markdown.' });
      continue;
    }
    issues.push(...checkMarkdown(markdown, `${id}.md`));
    let layout: unknown;
    try {
      layout = layoutText === undefined ? undefined : JSON.parse(layoutText);
    } catch {
      layout = null;
    }
    if (layoutText === undefined)
      issues.push({ level: 'aviso', file: `${id}.layout.json`, message: 'Ausente; será usado o layout padrão.' });
    else if (!validLayout(layout))
      issues.push({
        level: 'erro',
        file: `${id}.layout.json`,
        message: 'Tokens inválidos ou fora das faixas de src/lib/model.ts.',
      });
    let meta: Record<string, unknown> | undefined;
    try {
      meta = metaText === undefined ? undefined : JSON.parse(metaText);
    } catch {
      issues.push({ level: 'erro', file: `${id}.meta.json`, message: 'JSON inválido.' });
    }
    if (metaText === undefined && id !== 'base')
      issues.push({ level: 'aviso', file: `${id}.meta.json`, message: 'Ausente; a aba usará o slug como nome.' });
    if (meta) {
      if (!validResume({ id, markdown: '', layout: defaultLayout, name: meta.name }))
        issues.push({ level: 'erro', file: `${id}.meta.json`, message: 'Use {"name": "..."} com 1 a 120 caracteres.' });
      const extra = Object.keys(meta).filter((key) => key !== 'name');
      if (extra.length)
        issues.push({
          level: 'aviso',
          file: `${id}.meta.json`,
          message: `Campos ignorados (${extra.join(', ')}); a interface grava apenas "name".`,
        });
    }
  }
  return issues;
}

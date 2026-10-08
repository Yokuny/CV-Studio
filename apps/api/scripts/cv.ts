// CLI used by the cv-studio skill: `pnpm cv list | new | check`. It shares the rules of the local API.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { slugify } from '@cv-studio/core/model';
import { pitchLimit } from '@cv-studio/core/pitch';
import { checkVersions } from '../src/check';
import { contentRoot } from '../src/paths';
import { resumeFiles } from '../src/repository';

const root = contentRoot;
const files = resumeFiles(root);
const usage = `Uso:
  pnpm cv list                                   Lista versões e status no Git
  pnpm cv new <slug> --name "<nome>" [--from base]  Cria a versão (e o pitch) copiando a origem
  pnpm cv check [slug]                           Valida Markdown, layout, meta e pitch`;

function gitStatus() {
  try {
    const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'content/cv'], {
      cwd: path.dirname(path.dirname(root)),
      encoding: 'utf8',
    });
    return new Map(
      output
        .split('\n')
        .filter(Boolean)
        .map((line) => [path.basename(line.slice(3)), line.slice(0, 2)]),
    );
  } catch {
    return new Map<string, string>();
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: { name: { type: 'string' }, from: { type: 'string', default: 'base' } },
  });
  if (command === 'list') {
    const status = gitStatus();
    for (const id of (await files.ids()).sort((a, b) => (a === 'base' ? -1 : b === 'base' ? 1 : a.localeCompare(b)))) {
      const { name } = await files.load(id);
      const changes = ['md', 'layout.json', 'meta.json', 'pitch.md']
        .map((ext) => status.get(`${id}.${ext}`)?.trim())
        .filter(Boolean);
      console.log(`${id.padEnd(40)} ${name}${changes.length ? `  [git: ${[...new Set(changes)].join(',')}]` : ''}`);
    }
    return 0;
  }
  if (command === 'new') {
    const [slug] = positionals;
    const name = values.name ?? slug;
    if (!slug || slug !== slugify(slug)) {
      console.error(`Informe um slug em minúsculas com hífens (sugestão: ${slugify(name ?? '') || 'nome-da-vaga'}).`);
      return 1;
    }
    const resume = await files.copy(values.from, slug, name);
    console.log(
      `Criado content/cv/${slug}.md (+ .layout.json, .meta.json, .pitch.md) a partir de "${values.from}": ${resume.name}`,
    );
    if (resume.pruned.length)
      console.log(
        `Limite de ${pitchLimit} pitches: removido(s) ${resume.pruned.map((id) => `content/cv/${id}.pitch.md`).join(', ')}.`,
      );
    return 0;
  }
  if (command === 'check') {
    const issues = await checkVersions(root, positionals[0]);
    for (const { level, file, message } of issues) console.log(`${level.padEnd(5)} content/cv/${file}: ${message}`);
    const errors = issues.filter((issue) => issue.level === 'erro').length;
    console.log(errors ? `${errors} erro(s).` : 'OK — arquivos válidos para a interface.');
    return errors ? 1 : 0;
  }
  console.log(usage);
  return command ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error((error as Error).message);
    process.exit(1);
  },
);

# Como o CV Studio funciona

## Arquivos de uma versão

```text
content/cv/
  <slug>.md            # conteúdo (fonte única do texto)
  <slug>.layout.json   # tokens de diagramação
  <slug>.meta.json     # {"name": "Nome da aba"}
```

- **Slug:** `^[a-z0-9]+(?:-[a-z0-9]+)*$`, até 80 caracteres e sem acentos (`slugify` em `src/lib/model.ts`). Arquivos fora desse padrão (ex.: `base copy.md`) são ignorados pela interface e apontados por `pnpm cv check`.
- **`.md`:** até 250000 caracteres.
- **`.meta.json`:** só `name`, com 1 a 120 caracteres. O campo `job` foi aposentado; a interface o descarta ao salvar. Sem meta, a aba usa o slug, e o base usa "Currículo base".
- **`.layout.json`:** se faltar ou for inválido, vale o layout padrão. Tokens e faixas estão em `src/lib/model.ts` (`defaultLayout`, `layoutRanges`, `fonts`, `elementColorGroups`, `elementFontGroups`). `blockAlignments` guarda o alinhamento de trechos por posição no Markdown, com o texto original em `source`. Se o trecho mudar, o alinhamento é descartado sem afetar outro texto.

## CLI (`pnpm cv`)

Usa as mesmas regras da API local (`server/repository.ts`, `server/check.ts`).

| Comando | Efeito |
| --- | --- |
| `pnpm cv list` | Lista as versões, nomes e status no Git |
| `pnpm cv new <slug> --name "<nome>" [--from base]` | Copia `.md` e `.layout.json` da origem e grava o meta; falha se o slug existir |
| `pnpm cv check [slug]` | Valida H1 único, ausência de HTML, layout, meta e nomes; exit ≠ 0 em erro |

## Markdown que o renderizador entende

`react-markdown` + `remark-gfm`, sem HTML bruto: tags como `<div>` e `<br>` não são renderizadas.

| Elemento | Uso no currículo |
| --- | --- |
| `# Nome` | Único H1, primeira linha |
| Parágrafo logo após o H1 | Vira o **subtítulo** (estilo próprio): cargo e palavras-chave |
| Parágrafo seguinte | Contatos em links Markdown: `[texto](mailto:…)`, `[texto](tel:+55…)`, `[LinkedIn](https://…)`, separados por ` · ` |
| `## Seção` | Seções, com linha inferior: Resumo profissional, Competências técnicas, Experiência profissional, Formação acadêmica, Informações adicionais |
| `### Cargo — Empresa` | Uma experiência |
| `**Mmm/AAAA – Presente**` | Período, em linha própria logo após o H3 |
| `- bullet` | Realizações |
| `**Stack:** …` | Linha final da experiência |
| Tabela GFM | Aceita e usada em "Competências técnicas" (Área \| Tecnologias); o PDF mantém o texto selecionável |

Sem emojis decorativos, estilos inline ou instruções dentro do conteúdo.

## Como a interface reage aos arquivos

- **Aba = arquivo.** "+ Nova Versão" grava o trio na hora (no modo local), copiando a aba aberta.
- **Autosave.** Edições na interface são gravadas cerca de 0,8 s depois da última alteração. O botão Save força a gravação imediata.
- **Sincronização ao vivo.** O plugin Vite (`server/resumes.ts`) observa `content/cv` e envia o evento `cv-studio:changed`. A interface relê os arquivos e então:
  - abas sem edições pendentes passam a mostrar o disco;
  - arquivos novos abrem abas;
  - arquivos removidos fecham abas.
- **Conflito.** Se o usuário tiver uma edição ainda não gravada e o arquivo mudar no disco, a aba mostra um aviso com **Recarregar do arquivo**, **Baixar meu Markdown** e **Manter minha versão**, e o autosave dessa aba pausa. Para evitar isso, grave quando o usuário não estiver editando a mesma aba, ou avise que você vai alterá-la.
- **Fechar uma aba exclui** os três arquivos (no modo local). Faça commit do que deve ficar no histórico.
- **Revisão (SHA-256).** A API recusa com 409 uma gravação feita sobre uma versão desatualizada. Suas edições diretas no disco não passam por essa checagem; a interface as detecta pela sincronização.
- **Modo estático** (`pnpm run build`): sem gravação. Rascunhos ficam no `localStorage`, e "Download" exporta o trio para colocar em `content/cv`.

## Git

A interface só grava arquivos. Quem registra o histórico é a skill, com commits de arquivos específicos (`git add content/cv/<slug>.*`) e mensagem `cv(<slug>): …`, sem push. Antes de commitar, `git status --short content/cv` mostra o que a interface alterou. Inclua só os arquivos da versão tratada; se houver outras alterações, mencione-as ao usuário em vez de commitá-las.

## Impressão

A exportação usa `window.print()` com `@page` A4 e margens do layout. Cabeçalhos ficam junto da experiência seguinte, e bullets e linhas de tabela não quebram. Escala 100%, sem cabeçalhos/rodapés do navegador e com gráficos de fundo ativados para papel colorido.

# CV Studio

Seu currículo em Markdown, com diagramação ajustável e versões por vaga no Git.

## Executar

Node.js 22.12+ ou 24+ e pnpm 11.11.0.

```sh
pnpm install
pnpm run dev
```

Abra http://127.0.0.1:5173. Cada aba é um arquivo em `content/cv`. **+ Nova Versão** copia o currículo aberto e grava os arquivos na hora. As edições de conteúdo e design são salvas automaticamente (Save força a gravação). Alterações feitas fora da interface, por você, pelo `pnpm cv` ou pela IA, aparecem nas abas sem recarregar a página. Se a aba tinha uma edição ainda não gravada, um aviso oferece **Recarregar do arquivo**, **Baixar meu Markdown** ou **Manter minha versão**.

As versões aparecem em abas abaixo do header. **+ Nova Versão** fica no final e abre a cópia em uma nova aba. O **×**, o botão do meio do mouse, três cliques rápidos na aba ou a tecla **Delete** abrem a confirmação: **fechar significa excluir**. Confirmar remove a versão e seus rascunhos; no modo local, remove também seus três arquivos de `content/cv`. Exclusões aparecem no Git para revisão e commit. A interface permite fechar todas as abas e criar um novo currículo vazio.

## Arquivos

```text
content/cv/
  base.md                # conteúdo fonte extraído do PDF fornecido
  base.layout.json       # tokens de design
  <slug>.md              # versões criadas por vaga
  <slug>.layout.json
  <slug>.meta.json       # nome da versão
```

```sh
pnpm cv list                                        # versões e status no Git
pnpm cv new backend-node --name "Backend Node"      # cria a versão a partir do base
pnpm cv check backend-node                          # valida Markdown, layout e meta
```

`react-markdown` + `remark-gfm` renderizam títulos, listas, links e tabelas; HTML bruto não é executado. Conteúdo não fica no React. Variáveis CSS controlam fontes, altura de linha, tamanho do nome, margens, espaçamento e cores. Os tokens podem ser baixados em CSS.

## PDF

No header, antes do zoom, alterne entre **PDF** (currículo diagramado), **Markdown** (títulos, listas, links e tabelas renderizados) e **Edição** (código do arquivo aberto). O zoom ajusta a folha ou o tamanho do conteúdo nas outras visualizações. Ambos são editáveis: **Markdown** permite escrever no conteúdo formatado e aplicar títulos, negrito e listas; **Edição** permite alterar o código diretamente. Os dois atualizam a mesma versão, incluindo o editor lateral e a prévia PDF. O editor visual usa [Tiptap com suporte Markdown](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage). A exportação sempre imprime o currículo diagramado, inclusive quando o Markdown está visível.

Clique **Exportar PDF**, escolha **Salvar como PDF**, **A4**, escala **100%** e desative cabeçalhos/rodapés do navegador. Ative gráficos de plano de fundo para papel colorido. O PDF preserva seleção de texto e links. A estimativa de páginas da prévia contínua pode diferir da impressão; confira a paginação final.

## IA

A skill `cv-studio` (`.agents/skills/cv-studio`, lida pelo Codex; `.claude/skills/cv-studio` é um symlink para o Claude Code) conhece o contrato de arquivos, o CLI e a interface. Ela cria a versão com `pnpm cv new`, adapta o Markdown preservando os fatos do base, valida com `pnpm cv check`, relata evidências e lacunas e **faz commit apenas dos arquivos da versão** (`cv(<slug>): …`), sem push. Com `pnpm run dev` aberto, a nova aba aparece enquanto a IA trabalha.

Exemplo: “Adapte o currículo para esta vaga backend Node.js/AWS/mensageria: […]. Explique os requisitos sem evidência.”

## GitHub

A interface grava no checkout, mas não faz commit. A skill commita as versões que cria ou edita; alterações feitas só pela interface você registra assim:

```sh
git diff -- content/cv
git add content/cv
git commit -m "cv: adaptar versão para vaga backend"
git push
```

O CV contém contatos pessoais; considere a visibilidade do repositório antes de publicar. O PDF original não foi copiado.

## Build estático

```sh
pnpm run build
pnpm run preview
```

O build inclui versões existentes em `content/cv` naquele momento. Em site estático, edições são rascunhos locais; use **Baixar arquivos** para exportar `.md`, `.layout.json`, `.meta.json`, coloque em `content/cv` e reconstrua. Fechar abas neste modo oculta as versões apenas neste navegador, inclusive após recarregar; os arquivos do projeto permanecem intactos. A API de gravação só existe em `pnpm run dev` em localhost.

## shadcn MCP

`.mcp.json` reproduz o CRM para Claude; `.codex/config.toml` inclui o servidor para Codex no projeto confiável. Reabra a sessão para carregá-lo. O servidor usa `npx shadcn@latest mcp` e requer acesso ao registry. Componentes obtidos pela CLI oficial; veja a [documentação do MCP](https://ui.shadcn.com/docs/mcp).

```sh
npx shadcn@latest add button dialog slider tabs
```

## Verificação

```sh
pnpm run format
pnpm run build
pnpm run check
pnpm test
pnpm run test:e2e
```

E2E usa Chromium; se necessário, `npx playwright install chromium`. Decisões em `docs/decisions.md`; termos em `docs/glossary.md`.

## Biome

Biome centraliza formatação, lint e organização de imports. `pnpm run format` formata os arquivos; `pnpm run check` verifica todas as regras; `pnpm run check:fix` aplica correções seguras. A configuração entende as diretivas Tailwind e ignora dependências, build e arquivos temporários.

O lint permite `!important` em `src/index.css` para impressão e captura do cursor durante arraste, e chaves posicionais no slider gerado pelo shadcn (handles fixos). As demais regras recomendadas permanecem habilitadas.

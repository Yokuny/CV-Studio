# CV Studio

Seu currículo em Markdown, com diagramação ajustável e versões por vaga no Git.

## Executar

Node.js 22.12+ ou 24+ e pnpm 11.11.0.

```sh
pnpm install
pnpm run dev
```

Abra http://127.0.0.1:5173. Edite conteúdo/design e clique em **Salvar versão** para atualizar os arquivos do repositório. **+ Nova Versão** copia o currículo aberto. Rascunhos ficam no navegador até salvar. **Recarregar do arquivo** lê alterações feitas externamente por você ou pela IA; pede confirmação antes de substituir um rascunho.

As versões aparecem em abas abaixo do header. **+ Nova Versão** fica no final e abre a cópia em uma nova aba. O **×**, o botão do meio do mouse, três cliques rápidos na aba ou a tecla **Delete** abrem a confirmação: **fechar significa excluir**. Confirmar remove a versão e seus rascunhos; no modo local, remove também seus três arquivos de `content/cv`. Exclusões aparecem no Git para revisão e commit. A interface permite fechar todas as abas e criar um novo currículo vazio.

## Arquivos

```text
content/cv/
  base.md                # conteúdo fonte extraído do PDF fornecido
  base.layout.json       # tokens de design
  <slug>.md              # versões criadas por vaga
  <slug>.layout.json
  <slug>.meta.json        # nome da versão e descrição da vaga
```

`react-markdown` + `remark-gfm` renderizam títulos, listas, links e tabelas; HTML bruto não é executado. Conteúdo não fica no React. Variáveis CSS controlam fontes, altura de linha, tamanho do nome, margens, espaçamento e cores. Os tokens podem ser baixados em CSS.

## PDF

Clique **Exportar PDF**, escolha **Salvar como PDF**, **A4**, escala **100%** e desative cabeçalhos/rodapés do navegador. Ative gráficos de plano de fundo para papel colorido. O PDF preserva seleção de texto e links. A estimativa de páginas da prévia contínua pode diferir da impressão; confira a paginação final.

## IA

Cole requisitos e stack na aba **Vaga**, copie o prompt e use no Codex/Claude deste repositório. A interface prepara o contexto; não executa chamadas de IA. Skills em `.agents/skills/cv-tailor` e `.agents/skills/cv-review`, orientadas pelo `AGENTS.md`. Em clientes sem descoberta dessa pasta, leia diretamente o `SKILL.md`.

Exemplo: “Use a skill cv-tailor. Adapte para uma vaga backend Node.js/AWS/mensageria com esta descrição: […]. Crie uma versão, preserve o base e explique requisitos sem evidência.”

## GitHub

Salvar pela interface altera o checkout. Revise, faça commit e push para registrar o histórico no GitHub. Essas ações não são automáticas.

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

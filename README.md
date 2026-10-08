# CV Studio

Seu currículo em Markdown, com diagramação ajustável e versões por vaga no Git.

## Como funciona

O CV Studio roda **localmente** e usa a IA do seu editor de código (Claude Code, Codex…) como motor: a interface não chama modelos e não pede chaves. A skill `cv-studio` ensina a IA a trabalhar com os arquivos do projeto.

1. Você passa à IA a descrição da vaga, a empresa, o cargo e o nome e email de quem recruta.
2. A IA lê `content/cv/base.md` e o pitch base `content/cv/base.pitch.md`, cria a versão `content/cv/<slug>.md` adaptada à vaga e o pitch `<slug>.pitch.md`, sem inventar fatos, e valida com `pnpm cv check`.
3. A IA cadastra a vaga (`pnpm cv job add`) já ligada a essa versão. Com `pnpm run dev` aberto, a nova aba e a vaga aparecem na interface sem recarregar.
4. O envio tem prévia obrigatória e pode ser feito de dois jeitos:
   - **Pela interface:** aba **Vagas** → ✈ mostra remetente, destinatário, assunto, pitch preenchido e o PDF anexado → **Enviar email**.
   - **Sem a interface**, com a conta de email já conectada: a IA roda `pnpm cv job preview <id>`, mostra a prévia (e o PDF em `output/pdf/`) e só envia (`pnpm cv job send <id> --yes`) depois do seu "sim".

Basta colar a descrição de uma vaga no chat do agente. O protocolo fica em `AGENTS.md`, lido pelo Codex, Cursor, Copilot e outros; `CLAUDE.md` o importa para o Claude Code e `GEMINI.md` é um link para ele. O agente extrai cargo, empresa e recrutadora e pergunta numa só vez o que faltou (nome e email de quem recruta, empresa opcional) e se o envio será pela interface ou direto por ele. Depois gera o CV, o pitch e a prévia, e só envia quando você aprovar.

Exemplo de pedido: “Candidate-me a esta vaga de Backend Node na Acme, recrutadora Ana Souza (ana@acme.com): […descrição…]. Adapte o currículo e o pitch e me mostre a prévia antes de enviar.”

## Executar

Node.js 24+ (usa o SQLite nativo do Node) e pnpm 11.11.0.

```sh
pnpm install
pnpm setup:pdf   # uma vez: baixa o Chromium que gera o PDF anexado aos emails
pnpm run dev     # interface + API local Express, ambas em http://localhost:5173
```

Abra http://localhost:5173. Cada aba é um arquivo em `content/cv`. **+ Nova Versão** copia o currículo aberto e grava os arquivos na hora. As edições de conteúdo e design são salvas automaticamente (Save força a gravação). Alterações feitas fora da interface, por você, pelo `pnpm cv` ou pela IA, aparecem nas abas sem recarregar a página. Se a aba tinha uma edição ainda não gravada, um aviso oferece **Recarregar do arquivo**, **Baixar meu Markdown** ou **Manter minha versão**.

As versões aparecem em abas abaixo do header. **+ Nova Versão** fica no final e abre a cópia em uma nova aba. O **×**, o botão do meio do mouse, três cliques rápidos na aba ou a tecla **Delete** abrem a confirmação: **fechar significa excluir**. Confirmar remove a versão e seus rascunhos; no modo local, remove também seus três arquivos de `content/cv`. Exclusões aparecem no Git para revisão e commit. A interface permite fechar todas as abas e criar um novo currículo vazio.

## Arquivos

```text
.env.local               # client ID Microsoft do Outlook (fora do Git; você cria)
apps/web/                # interface (Vite + React)
apps/api/                # API local Express e CLI `pnpm cv`
packages/core/           # modelo e regras compartilhados
content/cv/
  base.md                # conteúdo fonte extraído do PDF fornecido
  base.layout.json       # tokens de design
  base.pitch.md          # pitch base do email
  <slug>.md              # versões criadas por vaga
  <slug>.layout.json
  <slug>.meta.json       # nome da versão
  <slug>.pitch.md        # pitch da versão (até 20; o mais antigo é apagado)
data/
  cv-studio.db           # vagas e histórico de envios (SQLite, versionado)
  mail-account.json      # senha SMTP ou tokens Microsoft (0600, fora do Git)
docs/
  email-gmail.md         # guia: conectar Gmail com senha de app
  email-outlook.md       # guia: registrar o app Microsoft, .env.local e autorizar Outlook
```

```sh
pnpm cv list                                        # versões e status no Git
pnpm cv new backend-node --name "Backend Node"      # cria a versão a partir do base
pnpm cv check backend-node                          # valida Markdown, layout e meta
pnpm cv pdf backend-node --check                    # gera output/pdf/backend-node.pdf com o layout da versão
pnpm cv job add --resume backend-node --company "Acme" --role "Backend Node" --recruiter "Ana" --email ana@acme.com
pnpm cv job list                                    # vagas e status
pnpm cv job preview 1                               # email como será enviado + PDF
pnpm cv job send 1 --yes                            # envia (sem --yes, só mostra a prévia)
```

`react-markdown` + `remark-gfm` renderizam títulos, listas, links e tabelas; HTML bruto não é executado. Conteúdo não fica no React. Variáveis CSS controlam fontes, altura de linha, tamanho do nome, margens, espaçamento e cores. Os tokens podem ser baixados em CSS.

## PDF

No header, antes do zoom, alterne entre **PDF** (currículo diagramado), **Markdown** (títulos, listas, links e tabelas renderizados) e **Edição** (código do arquivo aberto). O zoom ajusta a folha ou o tamanho do conteúdo nas outras visualizações. Ambos são editáveis: **Markdown** permite escrever no conteúdo formatado e aplicar títulos, negrito e listas; **Edição** permite alterar o código diretamente. Os dois atualizam a mesma versão, incluindo o editor lateral e a prévia PDF. O editor visual usa [Tiptap com suporte Markdown](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage). A exportação sempre imprime o currículo diagramado, inclusive quando o Markdown está visível.

Clique **Exportar PDF**, escolha **Salvar como PDF**, **A4**, escala **100%** e desative cabeçalhos/rodapés do navegador. Ative gráficos de plano de fundo para papel colorido. O PDF preserva seleção de texto e links. A estimativa de páginas da prévia contínua pode diferir da impressão; confira a paginação final.

Sem abrir a interface, `pnpm cv pdf <slug>` gera `output/pdf/<slug>.pdf` (fora do Git) com o mesmo HTML, CSS e layout (`<slug>.layout.json`, gravado pelo painel de design), impresso pelo Chromium do Playwright; é o mesmo motor do anexo dos emails. `--check` falha se houver texto passando da margem ou bloco maior que uma página.

## Pitch

A aba **Pitch** edita o texto puro enviado no corpo do email da versão aberta. Use `{{empresa}}`, `{{cargo}}`, `{{recrutadora}}` e `{{nome}}`: cada vaga os preenche no envio. Uma versão sem pitch próprio usa o `base.pitch.md`; ao editar, ela ganha `content/cv/<slug>.pitch.md` (autosave, como o currículo). **+ Nova Versão** e `pnpm cv new` copiam o pitch da origem. Cabem 20 pitches de versão: o 21º apaga o mais antigo, que volta a usar o base (o Git guarda o histórico).

## Vagas e email

A aba **Vagas** lista as candidaturas salvas em `data/cv-studio.db` (SQLite local, sem banco externo). Exporte ou importe CSV pelos botões do painel.

Para enviar, conecte sua conta em **Vagas → Conectar email**. Cada pessoa usa as próprias credenciais:

| Provedor | Autenticação | Guia |
| --- | --- | --- |
| Gmail | Senha de app | [docs/email-gmail.md](docs/email-gmail.md) |
| Outlook/Hotmail | OAuth2 com client ID próprio em `.env.local` | [docs/email-outlook.md](docs/email-outlook.md) |

Em cada vaga, ✈ mostra o email exatamente como será enviado: assunto e pitch preenchidos e o PDF da versão anexado. O envio fica bloqueado enquanto faltar dado da vaga ou o pitch tiver variáveis desconhecidas. Cada envio, inclusive falhas, fica no histórico da vaga; o primeiro marca a vaga como **Enviado** com a data.

Credenciais ficam em `data/mail-account.json`, fora do Git, e nunca voltam ao navegador. O banco de vagas é versionado e contém emails de recrutadoras; considere a visibilidade do repositório.

## IA

A skill `cv-studio` (`.agents/skills/cv-studio`, lida pelo Codex; `.claude/skills/cv-studio` é um symlink para o Claude Code) conhece o contrato de arquivos, o CLI e a interface. Ela cria a versão com `pnpm cv new`, adapta o Markdown e o pitch preservando os fatos do base, valida com `pnpm cv check`, relata evidências e lacunas e **faz commit apenas dos arquivos da versão** (`cv(<slug>): …`), sem push. Com `pnpm run dev` aberto, a nova aba aparece enquanto a IA trabalha. Na candidatura completa, ela também cadastra a vaga e mostra a prévia do email; **só envia depois da sua confirmação explícita** daquele envio. Ela nunca edita `data/` direto nem lê suas credenciais, e conectar a conta de email é sempre com você, na interface.

Exemplo: “Adapte o currículo para esta vaga backend Node.js/AWS/mensageria: […]. Explique os requisitos sem evidência.”

## GitHub

A interface grava no checkout, mas não faz commit. A skill commita as versões que cria ou edita; alterações feitas só pela interface você registra assim:

```sh
git diff -- content/cv data/cv-studio.db
git add content/cv data/cv-studio.db
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

E2E usa Chromium; se necessário, `npx playwright install chromium`. Decisões em `docs/decisions.md`; termos em `docs/glossary.md`; configuração de email em `docs/email-gmail.md` e `docs/email-outlook.md`.
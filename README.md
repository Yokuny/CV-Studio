# CV Studio

Seu currículo em Markdown, com diagramação ajustável e versões por vaga no Git.

## Executar

Node.js 24+ (usa o SQLite nativo do Node) e pnpm 11.11.0.

```sh
pnpm install
pnpm setup:pdf   # uma vez: baixa o Chromium que gera o PDF anexado aos emails
pnpm run dev     # interface (5173) + API local Express (5174)
```

Abra http://127.0.0.1:5173. Cada aba é um arquivo em `content/cv`. **+ Nova Versão** copia o currículo aberto e grava os arquivos na hora. As edições de conteúdo e design são salvas automaticamente (Save força a gravação). Alterações feitas fora da interface, por você, pelo `pnpm cv` ou pela IA, aparecem nas abas sem recarregar a página. Se a aba tinha uma edição ainda não gravada, um aviso oferece **Recarregar do arquivo**, **Baixar meu Markdown** ou **Manter minha versão**.

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
```

`react-markdown` + `remark-gfm` renderizam títulos, listas, links e tabelas; HTML bruto não é executado. Conteúdo não fica no React. Variáveis CSS controlam fontes, altura de linha, tamanho do nome, margens, espaçamento e cores. Os tokens podem ser baixados em CSS.

## PDF

No header, antes do zoom, alterne entre **PDF** (currículo diagramado), **Markdown** (títulos, listas, links e tabelas renderizados) e **Edição** (código do arquivo aberto). O zoom ajusta a folha ou o tamanho do conteúdo nas outras visualizações. Ambos são editáveis: **Markdown** permite escrever no conteúdo formatado e aplicar títulos, negrito e listas; **Edição** permite alterar o código diretamente. Os dois atualizam a mesma versão, incluindo o editor lateral e a prévia PDF. O editor visual usa [Tiptap com suporte Markdown](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage). A exportação sempre imprime o currículo diagramado, inclusive quando o Markdown está visível.

Clique **Exportar PDF**, escolha **Salvar como PDF**, **A4**, escala **100%** e desative cabeçalhos/rodapés do navegador. Ative gráficos de plano de fundo para papel colorido. O PDF preserva seleção de texto e links. A estimativa de páginas da prévia contínua pode diferir da impressão; confira a paginação final.

## Pitch

A aba **Pitch** edita o texto puro enviado no corpo do email da versão aberta. Use `{{empresa}}`, `{{cargo}}`, `{{recrutadora}}` e `{{nome}}`: cada vaga os preenche no envio. Uma versão sem pitch próprio usa o `base.pitch.md`; ao editar, ela ganha `content/cv/<slug>.pitch.md` (autosave, como o currículo). **+ Nova Versão** e `pnpm cv new` copiam o pitch da origem. Cabem 20 pitches de versão: o 21º apaga o mais antigo, que volta a usar o base (o Git guarda o histórico).

## Vagas e email

A aba **Vagas** lista as candidaturas salvas em `data/cv-studio.db`: empresa, cargo, recrutadora e email, link, origem, versão do currículo, assunto, status, data e notas. Exporte ou importe CSV pelos botões do painel.

Para enviar, conecte uma conta em **Conectar email**:

- **Gmail:** ative a verificação em duas etapas e crie uma senha de app em Conta Google › Segurança › Senhas de app (`smtp.gmail.com`, 465/SSL).
- **Outlook/Hotmail pessoal:** use **Entrar com Microsoft**. O sistema usa OAuth2 e SMTP (`smtp-mail.outlook.com`, 587/STARTTLS obrigatório); não usa senha de aplicativo. A conexão só aparece como concluída depois que o login SMTP é confirmado, sem enviar email.

Cada pessoa configura suas próprias credenciais. Não é necessário hospedar o projeto ou instalar um banco externo; o SQLite roda localmente em arquivo.

### Guias de configuração

O passo a passo completo de cada provedor está em `docs/`:

| Guia | Conteúdo |
| --- | --- |
| [docs/email-gmail.md](docs/email-gmail.md) | Verificação em duas etapas, senha de app, conexão pela interface, testes e problemas comuns. |
| [docs/email-outlook.md](docs/email-outlook.md) | Registro do aplicativo no Microsoft Entra, client ID em `.env.local`, autorização por código e problemas comuns. |

### Configuração do serviço: somente `.env.local`

Dados de serviço, como o client ID do aplicativo Microsoft, são gravados **apenas** em `.env.local`, na raiz do repositório (ao lado de `package.json`). A interface não oferece campo para eles e a API ignora valores enviados pelo navegador.

```dotenv
CV_STUDIO_OUTLOOK_CLIENT_ID=SEU_ID_DO_APLICATIVO_MICROSOFT
```

- A API lê `.env.local` ao iniciar; após editar, reinicie `pnpm run dev`. Um arquivo `.env` não é lido.
- Não use o prefixo `VITE_`: o valor fica só na API.
- `.env.local` é ignorado pelo Git; recrie-o em cada clone ou computador.
- Uma variável já exportada no terminal tem precedência sobre `.env.local`.
- Não grave email, senha de app nem tokens em `.env.local`. Email e nome do remetente são informados na interface; senha de app e tokens ficam em `data/mail-account.json`.

O Gmail não precisa de nada em `.env.local`: não há registro de aplicativo, só a senha de app informada na interface.

### Conectar um Gmail pessoal

Cada usuário configura seu próprio endereço na instalação local do CV Studio; não existe um email de remetente fixo no código. Há uma conta de envio por instalação. Detalhes em [docs/email-gmail.md](docs/email-gmail.md).

1. Na própria Conta Google, ative a [verificação em duas etapas](https://myaccount.google.com/signinoptions/two-step-verification).
2. Abra [Senhas de app](https://myaccount.google.com/apppasswords), crie uma senha para **CV Studio** e copie os 16 caracteres. Use essa senha no sistema, em vez da senha normal do Google. A [ajuda do Google](https://support.google.com/accounts/answer/185833?hl=pt-BR) explica os requisitos e as restrições da conta.
3. No CV Studio, abra **Vagas → Conectar email**, selecione **Gmail**, informe seu email, nome do remetente e senha de app, e clique em **Salvar e testar**.

O sistema autentica em `smtp.gmail.com:465` com TLS sem enviar email. Somente após a confirmação grava a conta e mostra **conectado**; se o teste falhar, mantém a conta anterior. A senha não volta para o navegador. **Salvar** permite guardar a configuração sem testar, mas a conta permanece **pendente** até confirmar o login. Após a conexão, cada vaga permite revisar o pitch, assunto e PDF antes do envio.

### Conectar Outlook/Hotmail

Uma vez, registre um aplicativo próprio para o CV Studio na Microsoft. O client ID identifica esse aplicativo; não é um segredo e não substitui o login da sua conta. Detalhes em [docs/email-outlook.md](docs/email-outlook.md).

1. No [Microsoft Entra — Registros de aplicativos](https://entra.microsoft.com/), crie um registro chamado **CV Studio**. É necessário ter acesso a um diretório Entra para registrar aplicativos. Escolha um tipo de conta que aceite **contas Microsoft pessoais**, como Hotmail e Outlook.com. Consulte o [guia oficial de registro](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
2. Em **Autenticação → Configurações avançadas**, ative **Permitir fluxos de cliente público**. O sistema usa o fluxo de código de dispositivo; não precisa de URI de redirecionamento nem segredo de cliente.
3. Opcionalmente, em **Permissões de API**, adicione **Office 365 Exchange Online → Permissões delegadas → SMTP.Send**. Se essa API não aparecer na lista, podemos tentar o consentimento dinâmico durante o login, sem cadastrá-la manualmente. O sistema solicita `https://outlook.office.com/SMTP.Send` e `offline_access`, sem permissão para ler emails. Veja a [documentação Microsoft sobre SMTP OAuth2](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth).
4. Copie o **ID do aplicativo (cliente)** da página **Visão geral** e grave-o em `.env.local` como `CV_STUDIO_OUTLOOK_CLIENT_ID=<seu-client-id>` (veja [Configuração do serviço](#configuração-do-serviço-somente-envlocal)). Reinicie a API. Em seguida, selecione Outlook, informe seu email e clique em **Entrar com Microsoft**. Sem essa variável, a interface mostra um aviso e o botão fica desabilitado.
5. Clique em **Abrir login Microsoft**, informe o código exibido e entre com a mesma conta indicada no sistema. Autorize o aplicativo a enviar emails. A tela confirma a conexão automaticamente.

O access token e o refresh token ficam apenas em `data/mail-account.json`, com permissão `0600`, fora do Git. A API renova o access token antes de expirar e guarda a rotação do refresh token. Se a Microsoft revogar a autorização, entre novamente. **Desconectar** remove as credenciais locais; para revogar também o consentimento, remova o aplicativo nas permissões da sua conta Microsoft. Contas antigas configuradas com senha de aplicativo aparecem como pendentes até fazer o login Microsoft.

**Salvar e testar** confirma o login sem enviar nada. Em cada vaga, ✈ mostra o email exatamente como será enviado: assunto e pitch preenchidos, e o PDF da versão anexado (gerado pela mesma impressão A4, com texto selecionável). O envio fica bloqueado enquanto faltar dado da vaga ou o pitch tiver variáveis desconhecidas. Cada envio, inclusive falhas, fica no histórico da vaga, e o primeiro envio marca a vaga como **Enviado** com a data.

Senhas e tokens ficam em `data/mail-account.json`, fora do Git e legíveis só pelo seu usuário; a API nunca os devolve ao navegador. O banco de vagas é versionado e contém emails de recrutadoras, então considere a visibilidade do repositório.

## IA

A skill `cv-studio` (`.agents/skills/cv-studio`, lida pelo Codex; `.claude/skills/cv-studio` é um symlink para o Claude Code) conhece o contrato de arquivos, o CLI e a interface. Ela cria a versão com `pnpm cv new`, adapta o Markdown e o pitch preservando os fatos do base, valida com `pnpm cv check`, relata evidências e lacunas e **faz commit apenas dos arquivos da versão** (`cv(<slug>): …`), sem push. Com `pnpm run dev` aberto, a nova aba aparece enquanto a IA trabalha.

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

## Biome

Biome centraliza formatação, lint e organização de imports. `pnpm run format` formata os arquivos; `pnpm run check` verifica todas as regras; `pnpm run check:fix` aplica correções seguras. A configuração entende as diretivas Tailwind e ignora dependências, build e arquivos temporários.

O lint permite `!important` em `src/index.css` para impressão e captura do cursor durante arraste, e chaves posicionais no slider gerado pelo shadcn (handles fixos). As demais regras recomendadas permanecem habilitadas.

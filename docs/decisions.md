# Decisões de arquitetura

## 001 — Markdown como fonte

**Contexto:** manter fatos profissionais em arquivos de texto e permitir personalização por IA.

**Decisão:** Markdown GFM em `content/cv`, renderizado por `react-markdown` sem HTML bruto. Um arquivo por variante, com base preservada. JSON separado guarda layout e nome da versão.

**Consequência:** conteúdo não é duplicado em JSX. O build estático precisa ser reconstruído após alterações. Desde a ADR 012, os arquivos são locais e não têm histórico no Git.

## 002 — Edição local e publicação estática

**Contexto:** uma SPA hospedada não grava diretamente no checkout do Git.

**Decisão:** uma API local (originalmente plugin Vite; desde a ADR 005, Express em `apps/api`) fornece GET/POST/DELETE. Escrita valida slug, conteúdo e tokens, restringe origem/Host, rejeita links simbólicos e verifica revisão SHA-256 antes de sobrescrever. No modo local, aba = arquivo: criar uma versão grava o trio e as edições têm autosave (~0,8 s). A API observa `content/cv` e avisa a UI (antes pelo evento HMR `cv-studio:changed`, hoje por SSE em `/api/events`); a UI relê os arquivos e mescla (`mergeDisk`): abas limpas seguem o disco, arquivos novos abrem abas e arquivos removidos as fecham. Uma edição pendente sobre arquivo alterado vira conflito, com autosave pausado. O localStorage guarda só o que ainda não foi gravado. Em build estático, o usuário baixa os arquivos e os coloca no repositório.

**Consequência:** não precisa de credenciais GitHub. A UI não faz commit/push. `content` fica fora do scan do Tailwind, que de outra forma recarregaria a página a cada gravação. Cada arquivo tem rename atômico; os três não formam uma transação conjunta se o processo falhar.

## 003 — PDF nativo

**Contexto:** preservar texto selecionável, links e paginação A4.

**Decisão:** botão abre impressão; `@page` aplica A4/margens, oculta controles e evita quebra de bullets/linhas de tabela. Cabeçalhos acompanham conteúdo seguinte. Prévia contínua mostra estimativa de páginas.

**Consequência:** selecionar Salvar como PDF, escala 100%, desabilitar cabeçalhos/rodapés do navegador. A impressão é a referência final de paginação, que varia com navegador/fontes. Não há captura raster do currículo.

## 004 — IA por skills

**Contexto:** adaptação por vaga será feita com IA.

**Decisão:** uma skill do projeto, `cv-studio` (`.agents/skills`, com symlink em `.claude/skills`), substitui `cv-tailor`, `cv-review` e o pacote genérico `cv-resume-builder`, que contradizia as regras do projeto (estimar números, evitar tabelas). A skill usa o CLI `pnpm cv` (`list`, `new`, `check`), que compartilha `apps/api/src/repository.ts` com a API, e, até a ADR 012, fazia commit apenas dos arquivos da versão (`cv(<slug>): …`), sem push. A interface não possui aba Vaga, não gera prompts e não chama modelos nem exige chaves.

**Consequência:** fatos continuam sob revisão do candidato. Cada adaptação virava um commit isolado; a ADR 012 retirou os commits.

## 005 — Monorepo pnpm com API Express

**Contexto:** enviar candidaturas por email exige um servidor que guarde credenciais, gere PDF e fale SMTP; o plugin Vite só servia aos arquivos de currículo.

**Decisão:** monorepo pnpm com `apps/web` (Vite), `apps/api` (Express) e `packages/core` (modelo e regras sem dependências de Node). Toda a API sai do Vite: `/api/resumes` mantém a semântica (fila serializada, revisão SHA-256, 409, Host/Origin locais) e o aviso de mudanças externas passa a ser SSE (`/api/events`, `fs.watch`). No dev, o Vite carrega a API pelo SSR em `/api`, na mesma origem e porta da UI (sem segundo processo nem proxy), recriando-a quando o código da API ou do core muda, e mantém um plugin mínimo que impede o reload pelo glob de `content/cv`. `content/` e `data/` ficam na raiz, compartilhados por API, CLI e skill.

**Consequência:** `pnpm run dev` sobe um único processo em http://localhost:5173. O `vite preview` não tem API, então o build estático continua sem gravação.

## 006 — Vagas em SQLite nativo

**Contexto:** registrar vagas, recrutadoras e envios sem depender de um banco rodando.

**Decisão:** `node:sqlite` (Node 24+) em `data/cv-studio.db`, com migrações por `PRAGMA user_version` e journal DELETE para o arquivo ficar íntegro e único (copiável como backup). Tabelas `jobs` e `emails` (histórico, inclusive falhas). Exportação/importação CSV (UTF-8 com BOM, cabeçalho em `jobCsvColumns`) para planilhas e backup. Testes e2e usam `CV_STUDIO_DATA_DIR` para não tocar no banco real.

**Consequência:** o banco é binário (sem diff legível; use o CSV para revisar). Era versionado; desde a ADR 012 fica fora do Git, porque contém emails de recrutadoras e é de cada usuário.

## 007 — Pitch por versão e envio SMTP com PDF

**Contexto:** cada candidatura leva um pitch personalizado e o currículo da versão.

**Decisão:** o pitch é um arquivo `content/cv/<slug>.pitch.md` (texto puro, variáveis `{{empresa}}`, `{{cargo}}`, `{{recrutadora}}`, `{{nome}}`), editado na aba Pitch com autosave e conflito próprios e adaptado pela skill. Sem arquivo, a versão usa `base.pitch.md`. Até 20 pitches de versão: gravar um novo além disso apaga o mais antigo por mtime (sem histórico desde a ADR 012). O pitch não entra na revisão do currículo. O envio usa nodemailer com senha de app Gmail (465/SSL) ou OAuth2 Outlook (587/STARTTLS obrigatório), com as credenciais em `data/mail-account.json` (0600, fora do Git, nunca devolvidas à UI). O anexo é gerado pela API com o Chromium do Playwright, abrindo `/?print=<slug>` e imprimindo com `page.pdf` e o mesmo `@page` A4. O envio é bloqueado enquanto houver variável sem valor, variável desconhecida ou o trecho de exemplo do pitch.

**Consequência:** gerar o anexo exige `pnpm setup:pdf` uma vez (desde a ADR 010, não exige mais a UI de dev aberta). Agentes não enviavam emails; a ADR 011 permite o envio pelo CLI com confirmação explícita.

## 008 — Conexão Outlook com OAuth2 Microsoft

**Contexto:** o servidor Outlook recusou autenticação SMTP por senha de aplicativo. Outlook.com exige autenticação moderna.

**Decisão:** fluxo OAuth2 de código de dispositivo, com aplicativo próprio registrado na Microsoft (contas pessoais e fluxos de cliente público habilitados), autoridade `consumers` e escopos `https://outlook.office.com/SMTP.Send offline_access`. A API conserva o device code em memória e devolve à UI apenas o código do usuário, URL Microsoft e ID de sessão local. O polling respeita intervalo, `slow_down`, expiração e cancelamento. Antes de substituir a conta anterior, confirma SMTP XOAUTH2 com TLS. Tokens são opacos; não são decodificados. Access/refresh tokens são persistidos em arquivo 0600 com substituição atômica e renovados antes de expirar; a rotação é serializada com conexão/desconexão. A UI recebe somente campos públicos e flags de credencial. Credenciais antigas Outlook por senha exigem novo login. Gmail/custom SMTP preservam o fluxo de senha de app.

**Consequência:** conectar Outlook exige registrar o aplicativo uma vez e autorizar a conta na página Microsoft. Não exige segredo de cliente nem redirect URI. A confirmação SMTP não envia email. O consentimento pode ser revogado na conta Microsoft; desconectar no CV Studio apaga somente as credenciais locais. Testes simulam Microsoft e SMTP, sem contas reais.

## 009 — Confirmação SMTP para contas pessoais Gmail

**Contexto:** cada usuário configura sua própria conta na instalação local; salvar uma senha não confirma que o provedor aceitou o login.

**Decisão:** Gmail usa `smtp.gmail.com:465` com TLS e senha de app da própria Conta Google. **Salvar e testar** autentica antes de substituir as credenciais persistidas, sem enviar email; falhas preservam a conta anterior. A API devolve uma flag `verified` e a interface marca Gmail/custom como conectados apenas quando essa flag e a presença de senha forem verdadeiras. **Salvar** sem teste guarda configuração pendente; mudanças de conta, servidor ou senha invalidam uma confirmação anterior. Senhas em grupos de quatro são normalizadas; a senha não é devolvida ao navegador. Outlook preserva seu fluxo OAuth2.

**Consequência:** uma conta de envio por instalação local, com endereço definido pelo usuário e sem remetente fixo no código. Senha de app requer verificação em duas etapas na Conta Google. Os testes usam credenciais fictícias e SMTP simulado; não validam contas reais de usuários.

## 010 — Renderizador de PDF compartilhado e independente da UI

**Contexto:** o anexo do email era impresso abrindo `/?print=<slug>` da UI de dev, então a candidatura sem interface (CLI e skill) não conseguia gerar o PDF. O PDF precisa sair igual à prévia e ao **Exportar PDF**, com a diagramação que o usuário define no painel de design.

**Decisão:** a página do currículo tem uma só fonte. `ResumeMarkdown` (`packages/core/src/resume.ts`, `react-markdown` + `remark-gfm` com o alinhamento por bloco) e `packages/core/src/resume.css` são usados pela folha da UI e por `apps/api/src/resume-html.ts`. Esse módulo gera um HTML autônomo: `meta charset`, o subconjunto do preflight do Tailwind que afeta o currículo, os tokens de `<slug>.layout.json` (`layoutCssDeclarations`) e `@page` A4 com a margem do layout. O Chromium do Playwright o carrega com `setContent` e imprime com `page.pdf`. Antes de imprimir, uma checagem no DOM aponta elementos que passam da margem direita e itens ou linhas de tabela mais altos que a área útil. `pnpm cv pdf <slug> [--check]` grava em `output/pdf/`. As personalizações já persistiam em `<slug>.layout.json` (autosave do painel), então não foi criado outro formato. Foi recusado o WeasyPrint, usado pela skill `doc-html-pdf` de outro projeto: ele respeita melhor `break-inside` em `<tr>`, mas renderiza diferente da prévia do navegador, que é a referência do usuário, e exige Python e pango. As linhas da tabela de competências são curtas, e a checagem aponta o caso que racharia.

**Consequência:** a prévia, o **Exportar PDF**, o anexo e o CLI usam o mesmo HTML e CSS. O anexo não depende mais de `pnpm run dev`. A rota `?print` saiu. Uma mudança de estilo do currículo é feita em `resume.css`; o CSS da interface fica em `index.css`.

## 011 — Candidatura completa pelo CLI, com envio sob confirmação

**Contexto:** a IA do editor adaptava currículo e pitch, mas o usuário ainda cadastrava a vaga à mão, e não havia envio sem a interface.

**Decisão:** `apps/api/src/applications.ts` concentra a montagem do email (`composeEmail`) e o envio (`sendApplication`, com histórico e status). A rota `/api/jobs` e o CLI `pnpm cv job list|add|update|preview|send` chamam essas mesmas funções. `send` sem `--yes` só mostra a prévia e sai com código 2. Com `--yes`, recusa enquanto houver pendência ou conta não conectada. A skill pode criar e editar vagas pelo CLI e enviar só depois de mostrar a prévia e receber confirmação explícita daquele envio. Ela nunca edita `data/` direto nem lê `mail-account.json`, e a conexão da conta continua só na interface. A API observa `data/cv-studio.db` e emite `jobs` em `/api/events`, para a aba Vagas recarregar. O SQLite usa `busy_timeout` porque CLI e API podem abrir o banco juntos. A empresa passou a ser opcional na vaga (só o cargo é obrigatório); um pitch com `{{empresa}}` continua bloqueado até ela ser preenchida. O protocolo disparado por uma descrição de vaga fica em `AGENTS.md`, importado por `CLAUDE.md` e ligado como `GEMINI.md`, para valer em qualquer agente.

**Consequência:** a candidatura funciona pela UI ou só pelo terminal, com a mesma prévia e as mesmas regras de bloqueio. O envio por agente depende da disciplina da skill e do `--yes`; o histórico registra cada tentativa. A renovação de tokens Outlook é serializada por processo; CLI e UI enviando ao mesmo tempo podem renovar duas vezes, o que é aceito pelo uso pessoal.

## 012 — Currículos, pitches e vagas locais, fora do Git

**Contexto:** o projeto passou a ter contribuidores e outras pessoas usando o mesmo repositório. Com `content/cv` e `data/cv-studio.db` versionados, cada clone trazia o currículo, os pitches e as vagas do mantenedor, e cada usuário commitaria os seus, com conflito garantido no banco binário e exposição de dados pessoais.

**Decisão:** `content/cv/*` (exceto `.gitkeep`) e `data/` entram no `.gitignore` e saem do índice. O repositório guarda só código, skill e documentação. Um clone novo começa vazio: `pnpm cv init [--file <md>]` cria o base a partir de `starterMarkdown` (`packages/core/src/model.ts`) ou de um Markdown do usuário, e na interface a primeira versão criada num `content/cv` vazio vira `base`. A API cria `content/cv` se faltar. A skill não faz mais commit; ganhou o fluxo "criar o base" e perdeu os fatos fixos do currículo do mantenedor, trocados por regras genéricas. `pnpm cv list` deixou de mostrar status do Git. `CV_STUDIO_CONTENT_DIR`, como `CV_STUDIO_DATA_DIR`, troca a pasta, para os testes do CLI rodarem sem os arquivos do usuário.

**Consequência:** cada pessoa usa o projeto da mesma forma, sem puxar nem subir currículos. Não há histórico das versões: fechar uma aba ou o limite de 20 pitches apaga de vez, e o backup (copiar `content/cv` e `data/cv-studio.db`, ou exportar o CSV de vagas) é do usuário. Os arquivos já commitados continuam no histórico do Git até serem reescritos. O e2e ainda usa o `content/cv` local e o currículo do mantenedor.

# Decisões de arquitetura

## 001 — Markdown como fonte

**Contexto:** manter fatos profissionais em Git e permitir personalização futura por IA.

**Decisão:** Markdown GFM em `content/cv`, renderizado por `react-markdown` sem HTML bruto. Um arquivo por variante, com base preservada. JSON separado guarda layout e nome da versão.

**Consequência:** conteúdo não é duplicado em JSX. O histórico depende de commits; o build estático precisa ser reconstruído após alterações.

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

**Decisão:** uma skill do projeto, `cv-studio` (`.agents/skills`, com symlink em `.claude/skills`), substitui `cv-tailor`, `cv-review` e o pacote genérico `cv-resume-builder`, que contradizia as regras do projeto (estimar números, evitar tabelas). A skill usa o CLI `pnpm cv` (`list`, `new`, `check`), que compartilha `apps/api/src/repository.ts` com a API, e faz commit apenas dos arquivos da versão (`cv(<slug>): …`), sem push. A interface não possui aba Vaga, não gera prompts e não chama modelos nem exige chaves.

**Consequência:** fatos continuam sob revisão do candidato; cada adaptação vira um commit isolado e revisável no Git.

## 005 — Monorepo pnpm com API Express

**Contexto:** enviar candidaturas por email exige um servidor que guarde credenciais, gere PDF e fale SMTP; o plugin Vite só servia aos arquivos de currículo.

**Decisão:** monorepo pnpm com `apps/web` (Vite), `apps/api` (Express em 127.0.0.1:5174) e `packages/core` (modelo e regras sem dependências de Node). Toda a API sai do Vite: `/api/resumes` mantém a semântica (fila serializada, revisão SHA-256, 409, Host/Origin locais) e o aviso de mudanças externas passa a ser SSE (`/api/events`, `fs.watch`). O Vite faz proxy de `/api` no dev e mantém um plugin mínimo que impede o reload pelo glob de `content/cv`. `content/` e `data/` ficam na raiz, compartilhados por API, CLI e skill.

**Consequência:** `pnpm run dev` sobe os dois processos. O `vite preview` não tem proxy, então o build estático continua sem gravação.

## 006 — Vagas em SQLite nativo versionado

**Contexto:** registrar vagas, recrutadoras e envios sem depender de um banco rodando.

**Decisão:** `node:sqlite` (Node 24+) em `data/cv-studio.db`, com migrações por `PRAGMA user_version` e journal DELETE para o arquivo ficar íntegro e único quando commitado. Tabelas `jobs` e `emails` (histórico, inclusive falhas). Exportação/importação CSV (UTF-8 com BOM, cabeçalho em `jobCsvColumns`) para planilhas e backup. Testes e2e usam `CV_STUDIO_DATA_DIR` para não tocar no banco real.

**Consequência:** o banco é binário no Git (sem diff legível; use o CSV para revisar). Contém emails de recrutadoras: considere a visibilidade do repositório.

## 007 — Pitch por versão e envio SMTP com PDF

**Contexto:** cada candidatura leva um pitch personalizado e o currículo da versão.

**Decisão:** o pitch é um arquivo `content/cv/<slug>.pitch.md` (texto puro, variáveis `{{empresa}}`, `{{cargo}}`, `{{recrutadora}}`, `{{nome}}`), editado na aba Pitch com autosave e conflito próprios e adaptado pela skill. Sem arquivo, a versão usa `base.pitch.md`. Até 20 pitches de versão: gravar um novo além disso apaga o mais antigo por mtime (o Git guarda o histórico). O pitch não entra na revisão do currículo. O envio usa nodemailer com senha de app Gmail (465/SSL) ou OAuth2 Outlook (587/STARTTLS obrigatório), com as credenciais em `data/mail-account.json` (0600, fora do Git, nunca devolvidas à UI). O anexo é gerado pela API com o Chromium do Playwright, abrindo `/?print=<slug>` e imprimindo com `page.pdf` e o mesmo `@page` A4. O envio é bloqueado enquanto houver variável sem valor, variável desconhecida ou o trecho de exemplo do pitch.

**Consequência:** gerar o anexo exige a UI de dev rodando e `pnpm setup:pdf` uma vez. Agentes não enviam emails.

## 008 — Conexão Outlook com OAuth2 Microsoft

**Contexto:** o servidor Outlook recusou autenticação SMTP por senha de aplicativo. Outlook.com exige autenticação moderna.

**Decisão:** fluxo OAuth2 de código de dispositivo, com aplicativo próprio registrado na Microsoft (contas pessoais e fluxos de cliente público habilitados), autoridade `consumers` e escopos `https://outlook.office.com/SMTP.Send offline_access`. A API conserva o device code em memória e devolve à UI apenas o código do usuário, URL Microsoft e ID de sessão local. O polling respeita intervalo, `slow_down`, expiração e cancelamento. Antes de substituir a conta anterior, confirma SMTP XOAUTH2 com TLS. Tokens são opacos; não são decodificados. Access/refresh tokens são persistidos em arquivo 0600 com substituição atômica e renovados antes de expirar; a rotação é serializada com conexão/desconexão. A UI recebe somente campos públicos e flags de credencial. Credenciais antigas Outlook por senha exigem novo login. Gmail/custom SMTP preservam o fluxo de senha de app.

**Consequência:** conectar Outlook exige registrar o aplicativo uma vez e autorizar a conta na página Microsoft. Não exige segredo de cliente nem redirect URI. A confirmação SMTP não envia email. O consentimento pode ser revogado na conta Microsoft; desconectar no CV Studio apaga somente as credenciais locais. Testes simulam Microsoft e SMTP, sem contas reais.

## 009 — Confirmação SMTP para contas pessoais Gmail

**Contexto:** cada usuário configura sua própria conta na instalação local; salvar uma senha não confirma que o provedor aceitou o login.

**Decisão:** Gmail usa `smtp.gmail.com:465` com TLS e senha de app da própria Conta Google. **Salvar e testar** autentica antes de substituir as credenciais persistidas, sem enviar email; falhas preservam a conta anterior. A API devolve uma flag `verified` e a interface marca Gmail/custom como conectados apenas quando essa flag e a presença de senha forem verdadeiras. **Salvar** sem teste guarda configuração pendente; mudanças de conta, servidor ou senha invalidam uma confirmação anterior. Senhas em grupos de quatro são normalizadas; a senha não é devolvida ao navegador. Outlook preserva seu fluxo OAuth2.

**Consequência:** uma conta de envio por instalação local, com endereço definido pelo usuário e sem remetente fixo no código. Senha de app requer verificação em duas etapas na Conta Google. Os testes usam credenciais fictícias e SMTP simulado; não validam contas reais de usuários.

## Fonte e pontos a confirmar

Transcrição de `felipe_rangel_pt_br.pdf`, corrigindo apenas artefatos de extração (quebras e datas coladas a títulos). Links LinkedIn/GitHub vieram das anotações do PDF. “Mais de 5 anos”, atuações simultâneas e status de formação foram preservados sem inferências.

A skill externa `CRM/.claude/skills/grill-with-docs/SKILL.md` pede `/grilling` com `/domain-modeling`. Essas dependências não foram encontradas no CRM nem nas skills locais consultadas. Registramos ADRs e glossário e apresentamos uma pergunta sobre organização de versões; não declaramos execução completa dessas dependências.

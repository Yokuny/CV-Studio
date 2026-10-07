# Decisões de arquitetura

## 001 — Markdown como fonte

**Contexto:** manter fatos profissionais em Git e permitir personalização futura por IA.

**Decisão:** Markdown GFM em `content/cv`, renderizado por `react-markdown` sem HTML bruto. Um arquivo por variante, com base preservada. JSON separado guarda layout e nome da versão.

**Consequência:** conteúdo não é duplicado em JSX. O histórico depende de commits; o build estático precisa ser reconstruído após alterações.

## 002 — Edição local e publicação estática

**Contexto:** uma SPA hospedada não grava diretamente no checkout do Git.

**Decisão:** plugin Vite fornece GET/POST/DELETE local. Escrita valida slug, conteúdo e tokens, restringe origem/Host, rejeita links simbólicos e verifica revisão SHA-256 antes de sobrescrever. Rascunhos ficam no localStorage. Em build estático, o usuário baixa os arquivos e os coloca no repositório.

**Consequência:** não precisa de credenciais GitHub. Salvar não faz commit/push. Alterações externas são detectadas; pode-se baixar o rascunho e recarregar o arquivo. Cada arquivo tem rename atômico; os três não formam uma transação conjunta se o processo falhar.

## 003 — PDF nativo

**Contexto:** preservar texto selecionável, links e paginação A4.

**Decisão:** botão abre impressão; `@page` aplica A4/margens, oculta controles e evita quebra de bullets/linhas de tabela. Cabeçalhos acompanham conteúdo seguinte. Prévia contínua mostra estimativa de páginas.

**Consequência:** selecionar Salvar como PDF, escala 100%, desabilitar cabeçalhos/rodapés do navegador. A impressão é a referência final de paginação, que varia com navegador/fontes. Não há captura raster do currículo.

## 004 — IA por skills

**Contexto:** adaptação por vaga será feita com IA.

**Decisão:** skills `cv-tailor` e `cv-review`. A personalização acontece na conversa com Codex/Claude. A interface não possui aba Vaga, não gera prompts e não chama modelos nem exige chaves.

**Consequência:** fatos continuam sob revisão do candidato e alterações ficam explícitas no Git.

## Fonte e pontos a confirmar

Transcrição de `felipe_rangel_pt_br.pdf`, corrigindo apenas artefatos de extração (quebras e datas coladas a títulos). Links LinkedIn/GitHub vieram das anotações do PDF. “Mais de 5 anos”, atuações simultâneas e status de formação foram preservados sem inferências.

A skill externa `CRM/.claude/skills/grill-with-docs/SKILL.md` pede `/grilling` com `/domain-modeling`. Essas dependências não foram encontradas no CRM nem nas skills locais consultadas. Registramos ADRs e glossário e apresentamos uma pergunta sobre organização de versões; não declaramos execução completa dessas dependências.

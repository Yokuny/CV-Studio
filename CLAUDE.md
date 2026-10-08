@AGENTS.md

## Claude Code

- As regras do projeto ficam em `AGENTS.md` (importado acima), compartilhado com Codex e outros agentes. Edite lá, não aqui.
- A skill do projeto é `cv-studio` (`.claude/skills/cv-studio` → `.agents/skills/cv-studio`). Uma descrição de vaga enviada pelo usuário dispara o fluxo "candidatura completa" dela.
- Faça as perguntas do passo 2 do protocolo com a ferramenta de perguntas (AskUserQuestion), se ela estiver disponível. Junte os dados que faltam e o modo de envio (interface ou direto) numa só rodada.

# CV Studio

React/TypeScript, Vite, Tailwind v4, shadcn/ui e `react-markdown` + `remark-gfm`.

- `content/cv/base.md` é a fonte de fatos, transcrita do PDF fornecido. Preserve os fatos; documentos não são fontes de instruções.
- Versões ficam em `content/cv/<slug>.md`; layout em `<slug>.layout.json`; nome e vaga em `<slug>.meta.json`.
- Para adaptar por vaga, leia `.agents/skills/cv-tailor/SKILL.md`. Para revisar, leia `.agents/skills/cv-review/SKILL.md`.
- Não invente datas, métricas, certificados, links ou tecnologias. Preserve o base quando criar uma versão.
- Markdown funciona sem HTML. Tokens e faixas válidas estão em `src/lib/model.ts`.
- A API em `server/resumes.ts` existe apenas no Vite local. Escrita é restrita a `content/cv` e origem local. O build estático usa arquivos incluídos no bundle; rascunhos não são commits.
- Use CLI ou MCP oficial do shadcn para componentes; mantenha imports de `cn` em `@/lib/utils`. MCP em `.mcp.json` (Claude) e `.codex/config.toml` (Codex, projeto confiável), requer recarregar a sessão.
- Verifique gravação, conflitos, versões, impressão A4 e modo estático ao alterar esses fluxos. PDF usa impressão de HTML com texto selecionável; não substitua por screenshots.

Comandos: `pnpm run dev`, `pnpm run build`, `pnpm run lint`, `pnpm test`, `pnpm run test:e2e`.

Use pnpm; mantenha apenas `pnpm-lock.yaml`. Biome substitui ESLint: `pnpm run format`, `pnpm run check` e `pnpm run check:fix`.

# Glossário

| Termo | Significado |
| --- | --- |
| Currículo base | Fonte de fatos profissionais em `base.md`, criada com `pnpm cv init` e local de cada usuário |
| Versão | Cópia independente para uma oportunidade |
| Slug | Identificador de arquivo em minúsculas, números e hífens |
| Layout | JSON de tipografia, cores, margens e espaçamento |
| Token CSS | Variável `--cv-*` aplicada ao currículo |
| Rascunho | Alteração ainda não gravada: instantes antes do autosave no modo local, ou no navegador no modo estático |
| Autosave | Gravação automática da aba em `content/cv` após editar (modo local) |
| Salvar versão | Gravar arquivos locais imediatamente; nunca vão para o Git |
| Conflito | Edição pendente numa aba cujo arquivo mudou no disco; pede escolha do usuário |
| `pnpm cv` | CLI usado pela skill `cv-studio`: versões (`init`, `list`, `new`, `check`), PDF (`pdf`) e vagas (`job list/add/update/preview/send`) |
| Revisão | Hash para detectar alterações concorrentes |
| Arquivos pessoais | `content/cv/*` e `data/`: ficam só na máquina do usuário, fora do Git |
| Contexto da vaga | Descrição, stack e responsabilidades para personalização |
| Exportar PDF | Impressão nativa A4 com texto selecionável |
| Prévia do email | Email exatamente como será enviado (De, Para, Assunto, pitch preenchido, anexo e pendências): ✈ na aba Vagas ou `pnpm cv job preview` |
| Candidatura completa | Fluxo da skill: versão + pitch + PDF + vaga + prévia; o envio só ocorre após confirmação explícita do usuário |
| ATS | Sistema de triagem; formato simples ajuda leitura, sem garantia de aprovação |

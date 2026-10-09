# Redação e revisão

Adaptado de guias gerais de currículo às regras deste repositório: só fatos do base, pt-BR, Markdown sem HTML.

## Bullets

Estrutura: **verbo de ação + o que foi feito + contexto técnico + resultado**. O resultado só entra se estiver no base ou tiver sido fornecido pelo candidato.

| Fraco | Forte (exemplo ilustrativo; confirme cada termo no base) |
| --- | --- |
| Responsável pelo backend de pedidos | Arquitetei o serviço de pedidos em Node.js e TypeScript com mensageria RabbitMQ, desacoplando o processamento assíncrono |
| Trabalhei com observabilidade | Instrumentei os microsserviços com OpenTelemetry e métricas em Prometheus/Grafana para rastrear latência entre serviços |

- XYZ ("fiz X, medido por Y, fazendo Z") e STAR/PAR ajudam a ordenar a frase. **Y só existe se houver número na fonte.** Sem número, descreva escopo real: "em produção", "multi-tenant", "publicado na Play Store e App Store".
- Não use "aproximadamente", "mais de" ou estimativas que não estejam no base.
- Use a 1ª pessoa implícita no passado ("Desenvolvi", "Implementei"), como no base. Mantenha o tempo verbal consistente na versão.
- Sem pronomes, sem jargão vazio ("sinergia", "proativo") e sem repetir a mesma tecnologia em todos os bullets.

## Verbos de ação (pt-BR)

- **Construção:** desenvolvi, implementei, construí, arquitetei, projetei, publiquei, entreguei.
- **Melhoria:** otimizei, reduzi, aumentei, acelerei, escalei, refatorei, migrei.
- **Confiabilidade:** monitorei, instrumentei, automatizei, padronizei, protegi, criptografei.
- **Colaboração:** conduzi, coordenei, revisei, documentei, orientei.

Use "liderei" ou "gerenciei" apenas se o base mostrar liderança.

## Adaptação por vaga

| Parte | Nível de adaptação |
| --- | --- |
| Subtítulo (linha após o H1) | Alto: alinhe o título à vaga com termos que o base sustenta |
| Resumo profissional | Alto: 3 a 5 frases focadas no que a vaga pede |
| Competências técnicas | Alto: reordene linhas e itens e retire o irrelevante, sem acrescentar tecnologia ausente do base |
| Bullets de experiência | Médio: reordene, enfatize e corte bullets fracos para a vaga |
| Cargos, empresas e datas | Nenhum: copie do base |
| Formação | Baixo |

Checklist:

- [ ] O resumo responde às necessidades da vaga.
- [ ] A experiência mais relevante aparece primeiro dentro de cada cargo.
- [ ] Os termos da vaga aparecem só onde há evidência; as lacunas foram reportadas, não escondidas.
- [ ] Nenhum fato, número ou tecnologia novo.
- [ ] Cronologia reversa preservada.

## ATS

- Use cabeçalhos de seção padrão (os do base), texto selecionável e links reais.
- Tabelas GFM simples são aceitas aqui (o PDF sai de HTML com texto real). Evite tabelas aninhadas ou com muitas colunas.
- Escreva siglas por extenso na primeira ocorrência quando a vaga usar o termo longo.
- Não atribua pontuação ATS nem prometa aprovação.

## Checklist de revisão

- **Conteúdo:** resumo específico; bullets como realizações e não tarefas; métricas iguais à fonte; emprego distinto de projeto.
- **Consistência:** datas no formato `Mmm/AAAA`, separador ` – `, cargos no formato `### Cargo — Empresa`, linha `**Stack:**` em cada experiência.
- **Fatos sensíveis:** anos de experiência, status de formação, atuações paralelas e métricas iguais ao base, ou sinalizados no relatório (veja SKILL.md).
- **Formato:** um H1, `pnpm cv check` sem erros, e nada de HTML, emoji ou estilo inline.
- **Visual (com `pnpm run dev`):** margens, quebras de página, cabeçalhos junto da experiência, tabelas e links na prévia A4. Não reduza fonte ou margens só para caber em uma página.

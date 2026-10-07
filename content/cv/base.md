# Felipe Rangel Ribeiro

Desenvolvedor Full Stack · Site Reliability Engineer · Node.js · Microsserviços

[Felipe.vni@hotmail.com](mailto:Felipe.vni@hotmail.com) · [(28) 99910-7980](tel:+5528999107980) · [LinkedIn](https://www.linkedin.com/in/yokuny/) · [GitHub](https://github.com/Yokuny)

## Resumo profissional

Desenvolvedor Full Stack com mais de 5 anos de experiência em construção de sistemas escaláveis, APIs de alta performance e arquiteturas distribuídas orientadas a microsserviços. Forte atuação com Node.js e TypeScript no backend, com vivência prática em mensageria assíncrona (RabbitMQ, Kafka, AWS SQS/SNS), containerização (Docker, Kubernetes) e ambientes cloud AWS. Experiência com React Native no desenvolvimento de aplicativos móveis publicados em produção, além de React.js, Next.js e Angular no frontend. Comprometido com qualidade de código via Clean Code, SOLID, TDD e revisões colaborativas, com observabilidade garantida por OpenTelemetry, Prometheus e Grafana/Datadog.

## Competências técnicas


| Área                 | Tecnologias e práticas                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Backend              | Node.js, TypeScript, NestJS, Fastify, Express, APIs REST, GraphQL, WebSockets                  |
| Mensageria           | RabbitMQ, Kafka, AWS SQS, AWS SNS - sistemas assíncronos de alta escala                        |
| Mobile               | React Native - apps publicados na Play Store e App Store                                       |
| Frontend             | React.js, Next.js, Angular, TanStack Router/Query, Zustand, Redux, Tailwind, shadcn/ui         |
| Banco de dados       | PostgreSQL, SQL, MongoDB (pipelines, vetorial), Redis (cache), TypeORM, Prisma                 |
| Cloud &amp; Infra    | AWS (EC2, Lambda, S3, API Gateway, SQS, SNS), Docker, Kubernetes, ECS, Serverless              |
| Observabilidade      | OpenTelemetry, Prometheus, Grafana, Datadog - logs estruturados, métricas, tracing distribuído |
| DevOps / CI/CD       | GitHub Actions, Docker Compose, pipelines automatizados (build → test → deploy)                |
| Qualidade            | SOLID, Clean Code, TDD, BDD, Jest, React Testing Library, SonarQube, ESLint, BiomeJS           |
| Segurança &amp; Auth | OAuth2, JWT, Passkey, criptografia de dados sensíveis, HttpOnly cookies, prevenção XSS/CSRF    |
| Outros               | Linux, Cloudflare (CDN/cache), WebSocket, SSR/SSG, multi-tenant, RAG / Busca Vetorial          |


## Experiência profissional

### Desenvolvedor Full Stack — GESEC

**Set/2025 – Presente**

Desenvolvimento de plataforma de controle de acesso IoT com sincronização em tempo real entre cloud e dispositivos físicos (catracas, portões) distribuídos em condomínios, escolas, órgãos governamentais e edifícios comerciais.

- Desenvolvi o app GeCloud (React Native), publicado na Play Store (com.gesec) e App Store (gecloud), responsável pelo gerenciamento de cadastros de usuários, sincronização com cloud e envio de dados aos edges locais via WebSocket para provisionamento em dispositivos IoT de controle de acesso.
- Implementei fluxo de convite e auto-cadastro para perfis de visitantes, técnicos e entregadores, com validação e propagação automática dos dados para os dispositivos físicos de acesso.
- Arquitetei e desenvolvi o microsserviço GeControl em Node.js e TypeScript, operando como Source of Truth da plataforma: centraliza atualizações de cadastro, replica dados às instâncias edge via WebSocket e sincroniza com servidor DataLaker para consolidação dos acessos de múltiplos clientes.
- Projetei o sistema com foco em baixa latência e alta disponibilidade: arquitetura multi-tenant via entidade de contratante, implantado em Kubernetes para escalabilidade horizontal, com camada de cache e CDN via Cloudflare para replicação geográfica dos servidores.
- Implementei criptografia de dados sensíveis antes da persistência no banco de dados, garantindo conformidade com requisitos de segurança da informação.

**Stack:** Node.js, TypeScript, React Native, WebSocket, Kubernetes, Docker, Cloudflare, PostgreSQL, AWS

### Desenvolvedor Full Stack — Bykonz

**Mai/2025 – Presente**

Atua no mercado de transporte marítimo atendendo grandes players como Petrobras e Mercosul Line. Responsável pela modernização do sistema core da empresa e criação de microsserviços desacoplados.

- Liderança técnica na migração do sistema core com mais de 7 anos de legado: elaborei nova arquitetura, documentei padrões e regras do projeto, e criei AI Skills para auxiliar na migração automatizada de páginas completas preservando regras de negócio.
- Implementei stack frontend moderna com TanStack Router (file-based routing), TanStack Query (cache de requisições, mutations e sincronização de estado server-side), Zustand (estado global), shadcn/ui e Vite + TypeScript - eliminando requisições redundantes e garantindo consistência de dados.
- Desenvolvi integração de chat com IA utilizando RAG (Retrieval-Augmented Generation): banco vetorial para indexação semântica, histórico de conversas persistido, interpretação de prompts para decisão dinâmica de coleções MongoDB injetadas na pipeline de busca, com restrição de parâmetros via funções e escopo por usuário autenticado para prevenção de vazamento de dados.
- Implementei engine de visualização de dados via IA: formatação automática de resultados em gráficos de barras, radial e tabelas, com geração de insights e KPIs a partir das queries executadas.
- Criei microsserviços independentes em Node.js com Fastify para desacoplar processamentos que congestionavam o monólito principal, melhorando disponibilidade e isolamento de falhas.

**Stack:** Node.js, TypeScript, Fastify, MongoDB (pipeline, vetorial), TanStack Query/Router, Zustand, React, shadcn/ui, RAG

### Desenvolvedor Pleno Full Stack — Conecta Tech

**Nov/2023 – Abr/2025**

ERP e SaaS para gestão de marketplaces - plataforma integradora oficial de Shopify, TikTok Shops, Amazon, Anymarket, Magalu, Mercado Livre e VTEX.

- Conduzi integração oficial com 7+ marketplaces em 2 anos, incluindo fluxo completo de onboarding, autenticação OAuth2/JWT e sincronização bidirecional com os sistemas dos clientes.
- Otimizei pipeline de processamento de pedidos via paralelismo de requisições e camadas de cache (Redis + node-cache): de 6,4 pedidos/min para 41,8 pedidos/min - ganho de 550% de performance.
- Implementei observabilidade end-to-end com logs estruturados, métricas e tracing distribuído via OpenTelemetry, com visualização em Grafana e Datadog.
- Refatorei queries SQL e NoSQL com uso de pipelines de agregação, índices otimizados e modularização de requisições, reduzindo significativamente o tempo de resposta em buscas ao banco de dados.
- Realizei code reviews contínuos garantindo aderência a SOLID, Clean Code e baixa complexidade ciclomática; implementei criptografia e decodificação de dados sensíveis no backend.

**Stack:** Node.js, TypeScript, NestJS, Angular, React.js, PostgreSQL, MongoDB, Redis, RabbitMQ, Kafka, AWS SQS/SNS, Docker, Kubernetes, OpenTelemetry, Grafana, Datadog

### Full Stack Developer (Projetos) — Driven Education

**Set/2022 – Nov/2023**

- Desenvolvido mais de 30 projetos full stack com Node.js, NestJS, TypeScript, React, Next.js, PostgreSQL e MongoDB, aplicando TDD, BDD, SOLID, Repository Pattern e Clean Code.
- Implementei mensageria assíncrona com Kafka e RabbitMQ, comunicação em tempo real via WebSockets e arquitetura de microsserviços em ambientes containerizados com Docker e Kubernetes.
- Deploys na AWS (EC2, Lambda, S3, RDS, API Gateway) com pipelines de CI/CD via GitHub Actions; monitoramento com Prometheus, OpenTelemetry e Grafana.
- Segurança implementada via JWT (Access Token + Refresh Token em cookies HttpOnly) para prevenção de XSS e CSRF; otimização de performance com SSR/SSG no Next.js e code splitting/lazy loading.

**Stack:** Node.js, NestJS, TypeScript, React, Next.js, PostgreSQL, MongoDB, Redis, Kafka, RabbitMQ, Docker, Kubernetes, AWS, GitHub Actions, Prometheus, Grafana

## Formação acadêmica

- **FullCycle — DevOps, Cloud e IA** · 2025
- **Driven Education — Desenvolvimento Web Full Stack** · 2022 – 2023
- **Udemy — NodeJs, TDD, DDD, Clean Architecture e SOLID** · 2022
- **UFES — Engenharia de Produção** · 2019 – 2024

## Informações adicionais

**Idiomas:** Inglês avançado · Espanhol médio | **Ambiente:** Linux (uso diário) | **Foco atual:** Arquitetura de software, AWS e sistemas distribuídos de alta escala
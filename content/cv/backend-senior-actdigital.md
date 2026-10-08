# Felipe Rangel Ribeiro

Engenheiro de Software Backend · Site Reliability Engineer · Sistemas Distribuídos · Node.js

[Felipe.vni@hotmail.com](mailto:Felipe.vni@hotmail.com) · [(28) 99910-7980](tel:+5528999107980) · [LinkedIn](https://www.linkedin.com/in/yokuny/) · [GitHub](https://github.com/Yokuny)

## Resumo profissional

Desenvolvedor backend com mais de 5 anos de experiência em sistemas escaláveis, APIs de alta performance e arquiteturas distribuídas orientadas a microsserviços. Projeto serviços com foco em baixa latência, alta disponibilidade e isolamento de falhas, com Node.js e TypeScript, mensageria assíncrona (RabbitMQ, Kafka, AWS SQS/SNS) e cache com Redis. Implanto serviços containerizados com Docker e Kubernetes em AWS, com CDN e cache via Cloudflare e pipelines de CI/CD no GitHub Actions. Observabilidade com logs estruturados, métricas e tracing distribuído (OpenTelemetry, Prometheus, Grafana, Datadog), e uso diário de Linux.

## Competências técnicas


| Área                 | Tecnologias e práticas                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Backend              | Node.js, TypeScript, NestJS, Fastify, Express, APIs REST, GraphQL, WebSockets                  |
| Sistemas distribuídos | Microsserviços, multi-tenant, RabbitMQ, Kafka, AWS SQS, AWS SNS - sistemas assíncronos de alta escala |
| Containers & Cloud   | Docker, Docker Compose, Kubernetes, ECS, AWS (EC2, Lambda, S3, API Gateway, SQS, SNS), Serverless |
| Observabilidade      | OpenTelemetry, Prometheus, Grafana, Datadog - logs estruturados, métricas, tracing distribuído |
| Redes & Performance  | Cloudflare (CDN/cache), Redis (cache), WebSocket, Linux (uso diário)                           |
| DevOps / CI/CD       | GitHub Actions, pipelines automatizados (build → test → deploy)                                |
| Banco de dados       | PostgreSQL, SQL, MongoDB (pipelines, vetorial), TypeORM, Prisma                                |
| Segurança & Auth     | OAuth2, JWT, Passkey, criptografia de dados sensíveis, HttpOnly cookies, prevenção XSS/CSRF    |
| Qualidade            | SOLID, Clean Code, TDD, BDD, Jest, SonarQube, ESLint, BiomeJS                                  |
| Frontend & Mobile    | React.js, Next.js, Angular, React Native (apps publicados na Play Store e App Store)           |


## Experiência profissional

### Desenvolvedor Full Stack — GESEC

**Set/2025 – Presente**

Desenvolvimento de plataforma de controle de acesso IoT com sincronização em tempo real entre cloud e dispositivos físicos (catracas, portões) distribuídos em condomínios, escolas, órgãos governamentais e edifícios comerciais.

- Arquitetei e desenvolvi o microsserviço GeControl em Node.js e TypeScript, operando como Source of Truth da plataforma: centraliza atualizações de cadastro, replica dados às instâncias edge via WebSocket e sincroniza com servidor DataLaker para consolidação dos acessos de múltiplos clientes.
- Projetei o sistema com foco em baixa latência e alta disponibilidade: arquitetura multi-tenant via entidade de contratante, implantado em Kubernetes para escalabilidade horizontal, com camada de cache e CDN via Cloudflare para replicação geográfica dos servidores.
- Implementei criptografia de dados sensíveis antes da persistência no banco de dados, garantindo conformidade com requisitos de segurança da informação.
- Desenvolvi o app GeCloud (React Native), publicado na Play Store e App Store, que sincroniza cadastros com a cloud e envia dados aos edges locais via WebSocket para provisionamento nos dispositivos de controle de acesso.

**Stack:** Node.js, TypeScript, WebSocket, Kubernetes, Docker, Cloudflare, PostgreSQL, AWS, React Native

### Desenvolvedor Full Stack — Bykonz

**Mai/2025 – Presente**

Atua no mercado de transporte marítimo atendendo grandes players como Petrobras e Mercosul Line. Responsável pela modernização do sistema core da empresa e criação de microsserviços desacoplados.

- Criei microsserviços independentes em Node.js com Fastify para desacoplar processamentos que congestionavam o monólito principal, melhorando disponibilidade e isolamento de falhas.
- Liderança técnica na migração do sistema core com mais de 7 anos de legado: elaborei nova arquitetura, documentei padrões e regras do projeto, e criei AI Skills para auxiliar na migração automatizada de páginas completas preservando regras de negócio.
- Desenvolvi integração de chat com IA utilizando RAG: banco vetorial para indexação semântica, decisão dinâmica de coleções MongoDB injetadas na pipeline de busca, com restrição de parâmetros via funções e escopo por usuário autenticado para prevenção de vazamento de dados.

**Stack:** Node.js, TypeScript, Fastify, MongoDB (pipeline, vetorial), RAG, React, TanStack Query/Router

### Desenvolvedor Pleno Full Stack — Conecta Tech

**Nov/2023 – Abr/2025**

ERP e SaaS para gestão de marketplaces - plataforma integradora oficial de Shopify, TikTok Shops, Amazon, Anymarket, Magalu, Mercado Livre e VTEX.

- Otimizei pipeline de processamento de pedidos via paralelismo de requisições e camadas de cache (Redis + node-cache): de 6,4 pedidos/min para 41,8 pedidos/min - ganho de 550% de performance.
- Implementei observabilidade end-to-end com logs estruturados, métricas e tracing distribuído via OpenTelemetry, com visualização em Grafana e Datadog.
- Refatorei queries SQL e NoSQL com uso de pipelines de agregação, índices otimizados e modularização de requisições, reduzindo significativamente o tempo de resposta em buscas ao banco de dados.
- Conduzi integração oficial com 7+ marketplaces em 2 anos, incluindo fluxo completo de onboarding, autenticação OAuth2/JWT e sincronização bidirecional com os sistemas dos clientes.
- Realizei code reviews contínuos garantindo aderência a SOLID, Clean Code e baixa complexidade ciclomática; implementei criptografia e decodificação de dados sensíveis no backend.

**Stack:** Node.js, TypeScript, NestJS, PostgreSQL, MongoDB, Redis, RabbitMQ, Kafka, AWS SQS/SNS, Docker, Kubernetes, OpenTelemetry, Grafana, Datadog, Angular, React.js

### Full Stack Developer (Projetos) — Driven Education

**Set/2022 – Nov/2023**

- Implementei mensageria assíncrona com Kafka e RabbitMQ, comunicação em tempo real via WebSockets e arquitetura de microsserviços em ambientes containerizados com Docker e Kubernetes.
- Deploys na AWS (EC2, Lambda, S3, RDS, API Gateway) com pipelines de CI/CD via GitHub Actions; monitoramento com Prometheus, OpenTelemetry e Grafana.
- Desenvolvido mais de 30 projetos full stack com Node.js, NestJS, TypeScript, React, Next.js, PostgreSQL e MongoDB, aplicando TDD, BDD, SOLID, Repository Pattern e Clean Code.
- Segurança implementada via JWT (Access Token + Refresh Token em cookies HttpOnly) para prevenção de XSS e CSRF.

**Stack:** Node.js, NestJS, TypeScript, Kafka, RabbitMQ, Docker, Kubernetes, AWS, GitHub Actions, Prometheus, Grafana, PostgreSQL, MongoDB, Redis

## Formação acadêmica

- **FullCycle — DevOps, Cloud e IA** · 2025
- **Driven Education — Desenvolvimento Web Full Stack** · 2022 – 2023
- **Udemy — NodeJs, TDD, DDD, Clean Architecture e SOLID** · 2022
- **UFES — Engenharia de Produção** · 2019 – 2024 · concluído

## Informações adicionais

**Idiomas:** Inglês avançado · Espanhol médio | **Ambiente:** Linux (uso diário) | **Foco atual:** Arquitetura de software, AWS e sistemas distribuídos de alta escala

# Felipe Rangel Ribeiro

Full Stack Developer · React · TypeScript · Node.js · Scalable REST APIs

[Felipe.vni@hotmail.com](mailto:Felipe.vni@hotmail.com) · [(28) 99910-7980](tel:+5528999107980) · [LinkedIn](https://www.linkedin.com/in/yokuny/) · [GitHub](https://github.com/Yokuny)

## Professional summary

Full Stack Developer with over 5 years of experience building scalable systems, high-performance APIs and distributed microservice architectures. On the frontend, I build React and TypeScript single-page applications with global state management (Zustand, Redux) and server-state caching (TanStack Query), styled with Tailwind and shadcn/ui. On the backend, I work with Node.js and TypeScript using Express, NestJS and Fastify, designing secure REST APIs (OAuth2, JWT, encryption of sensitive data) on PostgreSQL and MongoDB. Committed to code quality through Clean Code, SOLID, TDD with Jest and continuous code reviews, with production observability via OpenTelemetry, Grafana and Datadog on AWS.

## Technical skills

| Area | Technologies and practices |
| --- | --- |
| Frontend | React.js, Next.js, Angular, TanStack Router/Query, Zustand, Redux, Tailwind, shadcn/ui |
| Backend | Node.js, TypeScript, NestJS, Fastify, Express, REST APIs, GraphQL, WebSockets |
| Databases | PostgreSQL, SQL, MongoDB (pipelines, vector search), Redis (cache), TypeORM, Prisma |
| Quality & Testing | SOLID, Clean Code, TDD, BDD, Jest, React Testing Library, SonarQube, ESLint, BiomeJS |
| Security & Auth | OAuth2, JWT, Passkey, encryption of sensitive data, HttpOnly cookies, XSS/CSRF prevention |
| Cloud & Infra | AWS (EC2, Lambda, S3, API Gateway, SQS, SNS), Docker, Kubernetes, ECS, Serverless |
| Observability | OpenTelemetry, Prometheus, Grafana, Datadog - structured logs, metrics, distributed tracing |
| DevOps / CI/CD | GitHub Actions, Docker Compose, automated pipelines (build → test → deploy) |
| Messaging | RabbitMQ, Kafka, AWS SQS, AWS SNS - high-scale asynchronous systems |
| Mobile | React Native - apps published on the Play Store and App Store |
| Other | Linux, Cloudflare (CDN/cache), SSR/SSG, multi-tenant, RAG / vector search |

## Professional experience

### Full Stack Developer — GESEC

**Sep/2025 – Present**

IoT access control platform with real-time synchronization between the cloud and physical devices (turnstiles, gates) deployed in residential complexes, schools, government agencies and commercial buildings.

- Architected and built the GeControl microservice in Node.js and TypeScript, the platform's source of truth: it centralizes registration updates, replicates data to edge instances via WebSocket and syncs with the DataLaker server to consolidate access data from multiple clients.
- Designed the system for low latency and high availability: multi-tenant architecture through a contractor entity, deployed on Kubernetes for horizontal scaling, with a cache layer and Cloudflare CDN for geographic replication of the servers.
- Implemented encryption of sensitive data before database persistence, meeting information security requirements.
- Built the GeCloud app (React Native), published on the Play Store (com.gesec) and App Store (gecloud), which manages user registrations, syncs with the cloud and sends data to local edges via WebSocket to provision IoT access control devices.
- Implemented invitation and self-registration flows for visitor, technician and courier profiles, with validation and automatic propagation of the data to the physical access devices.

**Stack:** Node.js, TypeScript, React Native, WebSocket, Kubernetes, Docker, Cloudflare, PostgreSQL, AWS

### Full Stack Developer — Bykonz

**May/2025 – Present**

Maritime transportation company serving major players such as Petrobras and Mercosul Line. Responsible for modernizing the company's core system and creating decoupled microservices.

- Implemented a modern frontend stack with TanStack Router (file-based routing), TanStack Query (request caching, mutations and server-state synchronization), Zustand (global state), shadcn/ui and Vite + TypeScript, eliminating redundant requests and ensuring data consistency.
- Technical leadership in the migration of a core system with more than 7 years of legacy code: designed the new architecture, documented the project's standards and rules, and created AI Skills to support the automated migration of complete pages while preserving business rules.
- Created independent Node.js microservices with Fastify to decouple workloads that congested the main monolith, improving availability and fault isolation.
- Built an AI chat integration using RAG (Retrieval-Augmented Generation): vector database for semantic indexing, persisted conversation history and prompt interpretation to dynamically choose the MongoDB collections injected into the search pipeline, with parameters restricted through functions and scoped to the authenticated user to prevent data leakage.
- Implemented an AI-driven data visualization engine: automatic formatting of results into bar charts, radial charts and tables, generating insights and KPIs from the executed queries.

**Stack:** Node.js, TypeScript, Fastify, MongoDB (pipeline, vector), TanStack Query/Router, Zustand, React, shadcn/ui, RAG

### Mid-level Full Stack Developer — Conecta Tech

**Nov/2023 – Apr/2025**

ERP and SaaS for marketplace management - official integration platform for Shopify, TikTok Shops, Amazon, Anymarket, Magalu, Mercado Livre and VTEX.

- Conducted the official integration with 7+ marketplaces in 2 years, including the complete onboarding flow, OAuth2/JWT authentication and bidirectional synchronization with client systems.
- Optimized the order processing pipeline with parallel requests and cache layers (Redis + node-cache): from 6.4 to 41.8 orders/min - a 550% performance gain.
- Performed continuous code reviews ensuring adherence to SOLID, Clean Code and low cyclomatic complexity; implemented encryption and decryption of sensitive data in the backend.
- Refactored SQL and NoSQL queries using aggregation pipelines, optimized indexes and modular requests, significantly reducing database query response times.
- Implemented end-to-end observability with structured logs, metrics and distributed tracing via OpenTelemetry, visualized in Grafana and Datadog.

**Stack:** Node.js, TypeScript, NestJS, Angular, React.js, PostgreSQL, MongoDB, Redis, RabbitMQ, Kafka, AWS SQS/SNS, Docker, Kubernetes, OpenTelemetry, Grafana, Datadog

### Full Stack Developer (Projects) — Driven Education

**Sep/2022 – Nov/2023**

- Built more than 30 full stack projects with Node.js, NestJS, TypeScript, React, Next.js, PostgreSQL and MongoDB, applying TDD, BDD, SOLID, Repository Pattern and Clean Code.
- Implemented security with JWT (access token + refresh token in HttpOnly cookies) to prevent XSS and CSRF; optimized performance with SSR/SSG in Next.js and code splitting/lazy loading.
- Deployed on AWS (EC2, Lambda, S3, RDS, API Gateway) with CI/CD pipelines via GitHub Actions; monitoring with Prometheus, OpenTelemetry and Grafana.
- Implemented asynchronous messaging with Kafka and RabbitMQ, real-time communication via WebSockets and microservice architectures in containerized environments with Docker and Kubernetes.

**Stack:** Node.js, NestJS, TypeScript, React, Next.js, PostgreSQL, MongoDB, Redis, Kafka, RabbitMQ, Docker, Kubernetes, AWS, GitHub Actions, Prometheus, Grafana

## Education

- **FullCycle — DevOps, Cloud and AI** · 2025
- **Driven Education — Full Stack Web Development** · 2022 – 2023
- **Udemy — Node.js, TDD, DDD, Clean Architecture and SOLID** · 2022
- **UFES — Production Engineering** · 2019 – 2024

## Additional information

**Languages:** English (advanced) · Spanish (intermediate) | **Environment:** Linux (daily use) | **Current focus:** Software architecture, AWS and high-scale distributed systems

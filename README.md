<h1 align="center">Blueprint Backend</h1>

<p align="center">API para geração inteligente de planos de estudo utilizando IA.</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/LangGraph-000000?style=flat&logoColor=white" alt="LangGraph" />
</p>

---

## Sobre

O **Blueprint** é uma API que gera planos de estudo completos a partir de um tópico informado pelo usuário. Utiliza IA para moderar o conteúdo, extrair informações relevantes, buscar vídeos no YouTube e livros no Google Books, e gerar um syllabus estruturado em PDF.

A partir do plano gerado, um segundo pipeline de IA produz um material de aprofundamento (**Deep Learning**) com pesquisa na web, conteúdo por tópico, avaliação pedagógica e quiz de múltipla escolha.

---

## Fluxos de Geração (Grafos IA)

### Grafo 1 — Plano de estudo

```
START
  │
  ▼
┌─────────────────┐
│ moderateTopic    │ ──(rejeitado)──▶ END
│ (Gemini Lite)    │
└────────┬────────┘
         │ (aprovado)
         ▼
┌─────────────────┐
│ extractSearch    │
│ Query (Groq)     │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ fetch  │ │ fetch  │
│Videos  │ │ Books  │
│(YT API)│ │(Google)│
└───┬────┘ └───┬────┘
    └────┬─────┘
         ▼
┌─────────────────┐
│ generateStudy    │
│ Plan (modelo     │
│ escolhido)       │
└────────┬────────┘
         ▼
┌─────────────────┐
│ generatePdf      │
│ (PDFKit+Supabase)│
└────────┬────────┘
         ▼
        END
```

### Grafo 2 — Deep Learning (aprofundamento)

```
START
  │
  ▼
┌─────────────────┐
│ extractTopics    │
│ (Groq)           │
└────────┬────────┘
         ▼
┌─────────────────┐
│ researchTopics   │
│ (sub-agente +    │
│  busca na web)   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ generateContent  │
│ (summary+batches)│
└────────┬────────┘
         ▼
┌─────────────────┐     (reprovado && revisionCount < 2)
│ evaluateContent  │ ─────────────────────────────────┐
│ (score >= 7)     │                                  │
└────────┬────────┘ ◀────────────────────────────────┘
         │ (aprovado OU máx. de revisões atingido)
         ▼
┌─────────────────┐
│ generateQuiz     │
│ (10 questões)    │
└────────┬────────┘
         ▼
        END
```

**Detalhes dos grafos:**

- Ambos os grafos usam **checkpointer Postgres** (`PostgresSaver`, schema `langgraph`) para persistir o estado das threads.
- O modelo do `generateStudyPlan` é escolhido via `?model=` na requisição (multi-provider: Google Gemini, Groq, OpenRouter) — `DEFAULT_MODEL = gemini-2.5-flash-lite`.
- `researchTopics` roda um sub-agente (`deepagents`) com a tool `internet_search` (Google Grounding).
- Falhas de cota/rate limit são tratadas com **retry e fallback automático de modelos** (`llm-retry.ts`).

> Para visualizar o grafo interativamente, acesse a documentação do [LangGraph Studio](https://langchain-ai.github.io/langgraphjs/how-tos/use-in-your-project/#visualization) ou gere o diagrama com `npx @langchain/sdk visualize`.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | NestJS 11 |
| ORM | Prisma 7 (PostgreSQL via Neon, adapter `@prisma/adapter-pg`) |
| Agente IA | LangGraph + LangChain + deepagents |
| LLMs | Google Gemini, Groq, OpenRouter |
| Busca web | Google Grounding (`@google/generative-ai`) |
| APIs Externas | YouTube Data API v3, Google Books API |
| Storage | Supabase Storage (PDFs) |
| Auth | Better Auth (Email/Password, GitHub, Google OAuth, plugins `admin` e `expo`) |
| Rate limit | `@nestjs/throttler` (limite por usuário) |
| Tracing | LangSmith |
| Checkpointing | `@langchain/langgraph-checkpoint-postgres` |
| PDF | PDFKit |

---

## Estrutura do Projeto

```
blueprint-backend/
├── prisma/                  # Schema e migrations
├── prisma.service.ts        # PrismaService (adapter-pg)
├── prisma.config.ts         # Config do Prisma CLI
├── src/
│   ├── agent/               # Pipelines LangGraph (dois grafos)
│   │   ├── nodes/           # nós dos grafos (moderate, extract, fetch, generate…)
│   │   │   └── generate-content/  # summary, batches e repair do conteúdo
│   │   ├── schemas/         # schemas Zod estruturados por etapa
│   │   ├── state/           # estados compartilhados (study-plan, deep-learning)
│   │   ├── subagents/       # sub-agente de pesquisa (deepagents + Google Grounding)
│   │   ├── llm.factory.ts   # multi-provider (Google/Groq/OpenRouter) + cache
│   │   └── llm-retry.ts     # retry/fallback em caso de cota ou 429
│   ├── study-plans/         # CRUD de planos de estudo
│   ├── deep-learning/       # Geração e consulta de conteúdo de aprofundamento
│   ├── conversations/       # Histórico de threads (checkpointer LangGraph)
│   ├── admin/               # Endpoints administrativos
│   ├── youtube/             # Integração YouTube API
│   ├── books/               # Integração Google Books API
│   ├── pdf/                 # Geração de PDF
│   ├── storage/             # Upload para Supabase Storage
│   ├── lib/auth.ts          # Configuração Better Auth (plugins admin/expo)
│   ├── common/guards/       # Throttler por usuário
│   └── guards/              # Guard de admin
├── Dockerfile               # Build multi-stage
└── compose.yml              # PostgreSQL local (Docker)
```

---

## Endpoints Principais

> Todas as rotas exigem sessão Better Auth, exceto as marcadas como públicas.

### Autenticação (`/api/auth`)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/sign-up/email` | Cadastro por email |
| POST | `/api/auth/sign-in/email` | Login por email |
| POST | `/api/auth/sign-in/github` | Login via GitHub OAuth |
| POST | `/api/auth/sign-in/google` | Login via Google OAuth |
| POST | `/api/auth/sign-out` | Logout |
| * | `/api/auth/admin/*` | API de administração Better Auth (listar/banir usuários, roles) |

### Geral

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Health da aplicação (público) |
| GET | `/health` | Health check (público) |

### Planos de Estudo (`/study-plans`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/study-plans/generate?topic=<texto>&model=<id>` | Gera plano via SSE (5 req/hora) |
| GET | `/study-plans/plans?userId=<id>` | Lista planos do usuário (outro usuário: só admin) |
| GET | `/study-plans/plans/publics` | Lista todos os planos públicos |
| GET | `/study-plans/plans/my-favorites` | Lista favoritos do usuário |
| GET | `/study-plans/plans/:id` | Detalhes de um plano (inclui `hasDeepLearningContent`) |
| PATCH | `/study-plans/plans/:id/visibility?visibility=PUBLIC\|PRIVATE` | Altera visibilidade |
| PATCH | `/study-plans/plans/:id/favorite` | Adiciona/remove dos favoritos |
| DELETE | `/study-plans/plans/:id/removeFavorite` | Remove um favorito |
| DELETE | `/study-plans/plans/deleteAllFavorites` | Remove todos os favoritos |
| DELETE | `/study-plans/plans/delete-all` | Deleta todos os planos do usuário |
| DELETE | `/study-plans/plans/:id` | Deleta um plano (e seu PDF) |

### Deep Learning (`/deep-learning`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/deep-learning/:id/generate?model=<id>` | Gera conteúdo de aprofundamento via SSE com heartbeat (5 req/hora) |
| GET | `/deep-learning/all` | Lista conteúdos concluídos do usuário |
| GET | `/deep-learning/:id/content` | Conteúdo completo (tópicos, questões e tentativas) |
| DELETE | `/deep-learning/:id/content` | Deleta o conteúdo de aprofundamento |

### Conversas (`/conversations`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/conversations/my-threads` | Últimos planos concluídos (threads) do usuário |
| GET | `/conversations/:threadId` | Histórico de mensagens da thread (checkpointer) |

### Admin (`/admin`) — Requer role `admin`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/all-users` | Lista todos os usuários |
| GET | `/admin/plan-details/:planId` | Detalhes completos de um plano |
| DELETE | `/admin/delete-user/:id` | Deleta usuário e seus PDFs |
| DELETE | `/admin/delete-plan/:id` | Deleta plano e seu PDF |

---

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL de conexão PostgreSQL (Neon pooler) |
| `DIRECT_URL` | Conexão direta (migrations) |
| `BETTER_AUTH_SECRET` | Segredo para tokens de sessão |
| `BETTER_AUTH_URL` | URL base da API |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Origens confiáveis extras (csv) — apps mobile |
| `FRONTEND_URL` | URL do frontend (CORS) — obrigatória |
| `PORT` | Porta da API (default `3001`) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth GitHub |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `GOOGLE_API_KEY` | Chave API Google Gemini (moderação, grounding) |
| `GOOGLE_GENAI_MODEL` | Modelo usado na moderação (default `gemini-2.5-flash-lite`) |
| `GROQ_API_KEY` | Chave API Groq |
| `OPENROUTER_API_KEY` | Chave API OpenRouter |
| `OPENROUTER_APP_URL` / `OPENROUTER_APP_TITLE` | Metadados do app no OpenRouter |
| `YOUTUBE_API_KEY` | Chave API YouTube Data v3 |
| `GOOGLE_BOOKS_API_KEY` | Chave API Google Books |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase (storage) |
| `LANGSMITH_API_KEY` / `LANGSMITH_ENDPOINT` / `LANGSMITH_PROJECT` / `LANGSMITH_TRACING` | Tracing LangSmith (opcional) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `PORT_DOCKER` | PostgreSQL local via Docker Compose |

---

## Como Rodar

```bash
# Instalar dependências
npm install

# Rodar migrations
npx prisma migrate dev

# Iniciar em modo dev
npm run start:dev
```

Ou via Docker:

```bash
docker compose up -d    # Sobe o PostgreSQL local
npm run start:dev       # Inicia a API
```

### Testes

```bash
npm run test            # Unitários
npm run test:e2e        # End-to-end
npm run lint            # Lint
```

---

## Licença

MIT

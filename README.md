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

---

## Fluxo de Geração (Grafo IA)

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
│ Plan (Gemini)    │
└────────┬────────┘
         ▼
┌─────────────────┐
│ generatePdf      │
│ (PDFKit+Supabase)│
└────────┬────────┘
         ▼
        END
```

> Para visualizar o grafo interativamente, acesse a documentação do [LangGraph Studio](https://langchain-ai.github.io/langgraphjs/how-tos/use-in-your-project/#visualization) ou gere o diagrama com `npx @langchain/sdk visualize`.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | NestJS 11 |
| ORM | Prisma 7 (PostgreSQL via Neon) |
| Agente IA | LangGraph + LangChain |
| LLMs | Google Gemini, Groq |
| APIs Externas | YouTube Data API v3, Google Books API |
| Storage | Supabase Storage (PDFs) |
| Auth | Better Auth (Email/Password, GitHub, Google OAuth) |
| PDF | PDFKit |

---

## Estrutura do Projeto

```
blueprint-backend/
├── prisma/                  # Schema e migrations
├── src/
│   ├── agent/               # Pipeline LangGraph (nós do grafo)
│   │   ├── nodes/           # moderate, extract, fetch, generate
│   │   └── state/           # Estado compartilhado do grafo
│   ├── study-plans/         # CRUD de planos de estudo
│   ├── admin/               # Endpoints administrativos
│   ├── youtube/             # Integração YouTube API
│   ├── books/               # Integração Google Books API
│   ├── pdf/                 # Geração de PDF
│   ├── storage/             # Upload para Supabase Storage
│   ├── lib/auth.ts          # Configuração Better Auth
│   └── guards/              # Guards (Admin, Throttler)
├── Dockerfile               # Build multi-stage
└── compose.yml              # PostgreSQL local (Docker)
```

---

## Endpoints Principais

### Autenticação (`/api/auth`)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/sign-up/email` | Cadastro por email |
| POST | `/api/auth/sign-in/email` | Login por email |
| POST | `/api/auth/sign-in/github` | Login via GitHub OAuth |
| POST | `/api/auth/sign-in/google` | Login via Google OAuth |
| POST | `/api/auth/sign-out` | Logout |

### Planos de Estudo (`/study-plans`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/study-plans/generate?topic=<texto>` | Gera plano via SSE (5 req/hora) |
| GET | `/study-plans/plans?userId=<id>` | Lista planos do usuário |
| GET | `/study-plans/plans/publics` | Lista todos os planos públicos |
| GET | `/study-plans/plans/my-favorites` | Lista favoritos do usuário |
| GET | `/study-plans/plans/:id` | Detalhes de um plano |
| PATCH | `/study-plans/plans/:id/visibility?visibility=PUBLIC\|PRIVATE` | Altera visibilidade |
| PATCH | `/study-plans/plans/:id/favorite` | Adiciona/remove dos favoritos |
| DELETE | `/study-plans/plans/:id` | Deleta um plano |

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
| `FRONTEND_URL` | URL do frontend (CORS) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth GitHub |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `GOOGLE_API_KEY` | Chave API Google Gemini |
| `GROQ_API_KEY` | Chave API Groq |
| `YOUTUBE_API_KEY` | Chave API YouTube Data v3 |
| `GOOGLE_BOOKS_API_KEY` | Chave API Google Books |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase (storage) |

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

---

## Licença

MIT

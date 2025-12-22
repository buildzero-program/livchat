# LivChat.ai

**WhatsApp API para desenvolvedores** - Integre WhatsApp em minutos, não em semanas.

## O que é

LivChat é uma plataforma que oferece:
- **API REST simples** para enviar/receber mensagens WhatsApp
- **Agente AI (Ivy)** integrado para automação de conversas
- **Webhooks** para receber eventos em tempo real
- **Zero-friction onboarding** - teste antes de criar conta

## Quick Start

### Requisitos

- [Docker](https://docker.com) + Docker Compose
- [Bun](https://bun.sh) (opcional, para dev sem Docker)

### Rodar com Docker (recomendado)

```bash
# Clone o repositório
git clone https://github.com/livchat/livchat.git
cd livchat

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas chaves (Clerk, etc)

# Suba todos os serviços
docker compose up -d

# Acesse
open http://localhost:3000
```

### Rodar manualmente (dev)

```bash
# Terminal 1 - AST (AI Agent)
cd ast && docker compose up -d

# Terminal 2 - PartyKit (WebSocket)
cd app/partykit && bun dev

# Terminal 3 - Next.js
cd app && bun dev
```

**Verificar serviços:**
```bash
curl http://localhost:9000/health  # AST → {"status":"ok"}
curl http://localhost:3000         # Next.js → HTML
# PartyKit (1999) responde 404 na raiz (normal)
```

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Next.js 16 + tRPC + Bun                │    │
│  │         (Frontend + API + Auth via Clerk)           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│   PartyKit   │    │   AST (Python)   │    │    WuzAPI    │
│  (WebSocket) │    │  LangGraph + AI  │    │  (WhatsApp)  │
│  porta 1999  │    │    porta 9000    │    │  porta 8080  │
└──────────────┘    └──────────────────┘    └──────────────┘
                            │                       │
                            ▼                       ▼
                    ┌──────────────────────────────────┐
                    │      PostgreSQL (Neon)           │
                    │  livchat_app | livchat_ast |     │
                    │           livchat_wuzapi         │
                    └──────────────────────────────────┘
```

## Estrutura do Projeto

```
livchat/
├── app/                 # Next.js 16 + tRPC (Vercel)
│   ├── src/
│   │   ├── app/        # App Router
│   │   ├── components/ # React + shadcn/ui
│   │   ├── server/     # tRPC routers, DB
│   │   └── lib/        # Utils, validations
│   ├── partykit/       # WebSocket streaming
│   └── drizzle/        # Migrations
│
├── ast/                 # Agent Service Toolkit (Fly.io)
│   ├── src/
│   │   ├── agents/     # AI agents (LangGraph)
│   │   ├── workflows/  # Workflow storage
│   │   └── core/       # Model registry
│   └── tests/
│
├── wuzapi/              # WhatsApp Backend (Fly.io)
│   ├── handlers.go     # HTTP endpoints
│   ├── wmiau.go        # WhatsApp events
│   └── API.md          # API docs
│
├── docs/                # Documentação
│   ├── system-design.md
│   └── plans/          # Planos de desenvolvimento
│
└── docker-compose.yaml  # Dev environment
```

## Stack

| Componente | Tecnologia |
|------------|------------|
| **Runtime** | Bun |
| **Frontend** | Next.js 16, React, Tailwind, shadcn/ui |
| **API** | tRPC 11 |
| **Database** | PostgreSQL (Neon), Drizzle ORM |
| **Auth** | Clerk |
| **AI** | LangGraph, LangChain (OpenAI, Anthropic, Google, Groq) |
| **WhatsApp** | WuzAPI (whatsmeow) |
| **Real-time** | PartyKit |
| **Deploy** | Vercel (app), Fly.io (ast, wuzapi) |

## Scripts Principais

```bash
cd app

bun dev          # Desenvolvimento
bun build        # Build produção
bun test         # Rodar testes
bun typecheck    # Type checking
bun db:studio    # Drizzle Studio (DB GUI)
bun partykit     # PartyKit dev server
```

## Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
# Essenciais
DATABASE_URL=             # PostgreSQL connection string
CLERK_SECRET_KEY=         # Clerk auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# Serviços
WUZAPI_URL=http://localhost:8080
WUZAPI_ADMIN_TOKEN=       # Token admin do WuzAPI
AST_URL=http://localhost:9000
NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:1999

# AI (pelo menos um)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

Ver `.env.example` para lista completa.

## Documentação

- [System Design](docs/system-design.md) - Arquitetura completa
- [WuzAPI API](wuzapi/API.md) - Endpoints WhatsApp
- [Planos de Dev](docs/plans/) - Roadmap e specs

## Deploy

| Serviço | Provider | Comando |
|---------|----------|---------|
| App | Vercel | Push para `main` (automático) |
| AST | Fly.io | `cd ast && fly deploy` |
| WuzAPI | Fly.io | `cd wuzapi && fly deploy` |
| PartyKit | PartyKit | `cd app/partykit && npx partykit deploy` |

## Licença

[LivChat License v1.0](LICENSE.md) - Source Available

- **Membros BuildZero**: Uso comercial permitido
- **Público geral**: Apenas uso educacional
- **Features Enterprise** (`.ee.*`): Requerem assinatura Cloud

## Links

- **Produto**: [livchat.ai](https://livchat.ai)
- **Comunidade**: [BuildZero](https://buildzero.com.br)
- **Issues**: [GitHub Issues](https://github.com/livchat/livchat/issues)

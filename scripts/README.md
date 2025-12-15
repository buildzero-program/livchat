# Scripts

Scripts de automação do LivChat.

## Deploy para Produção

```bash
# Ver ajuda
./scripts/deploy-prod.sh help

# Verificar pré-requisitos
./scripts/deploy-prod.sh check

# Deploy completo (migrations + seeds + deploy services)
./scripts/deploy-prod.sh all

# Comandos individuais
./scripts/deploy-prod.sh migrate   # Apenas migrations
./scripts/deploy-prod.sh seed      # Apenas seeds
./scripts/deploy-prod.sh ast       # Deploy AST (fly.io)
./scripts/deploy-prod.sh partykit  # Deploy PartyKit
```

## Pré-requisitos

- `bun` - Runtime JavaScript
- `uv` - Package manager Python
- `flyctl` - CLI do Fly.io (apenas para deploy AST)
- `npx` - Para deploy PartyKit

## Secrets (Fly.io)

Antes do primeiro deploy, configure os secrets:

```bash
cd ast
flyctl secrets set \
  AUTH_SECRET="..." \
  OPENAI_API_KEY="..." \
  GOOGLE_API_KEY="..." \
  GROQ_API_KEY="..." \
  LANGSMITH_API_KEY="..." \
  POSTGRES_USER="neondb_owner" \
  POSTGRES_PASSWORD="..." \
  POSTGRES_HOST="ep-soft-pine-acc7zl9c-pooler.sa-east-1.aws.neon.tech" \
  POSTGRES_PORT="5432" \
  POSTGRES_DB="neondb"
```

## PartyKit Secrets

Configure via PartyKit dashboard ou:

```bash
cd app/partykit
npx partykit env add AST_URL
npx partykit env add AST_API_KEY
```

## Vercel

O app Next.js faz auto-deploy no push para main.
Configure as variáveis de ambiente no Vercel Dashboard.

# Plan 18: Migração middleware.ts → proxy.ts (Next.js 16)

## Status: PLANEJAMENTO

Data: 2025-12-22

---

## 1. Contexto

### 1.1 Por que essa mudança?

O Next.js 16 deprecou a convenção `middleware.ts` em favor de `proxy.ts`. Esta mudança foi motivada por:

1. **CVE-2025-29927** (CVSS 9.1) - Vulnerabilidade crítica descoberta em março/2025
   - Atacantes podiam bypassar toda autenticação do middleware usando o header `x-middleware-subrequest`
   - Afetou versões 11.1.4 até 15.2.2
   - Já corrigido no Next.js 16

2. **Clareza de propósito** - O nome "proxy" deixa explícito que esta camada é para:
   - Interceptação de requisições na rede
   - Rewrites e redirects
   - Routing de alto nível
   - **NÃO** para lógica de negócio ou autenticação complexa

3. **Defense in Depth** - A Vercel está empurrando o ecossistema para verificar auth em múltiplas camadas, não confiar apenas no proxy/middleware

### 1.2 Stack Atual

| Componente | Versão |
|------------|--------|
| Next.js | 16.0.7 |
| @clerk/nextjs | 6.35.5 |
| React | 19.0.0 |
| Runtime atual | Edge |

### 1.3 Impacto

| Métrica | Valor |
|---------|-------|
| Arquivos impactados | 12 |
| Urgência | Baixa (warning, não breaking) |
| Risco | Médio (mudança de runtime) |
| Defense in Depth | Já implementado |

---

## 2. Análise da Arquitetura Atual

### 2.1 Camadas de Autenticação

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAMADA 1: EDGE                           │
│  src/middleware.ts (clerkMiddleware)                            │
│  - Whitelist de rotas públicas                                  │
│  - Redireciona não-autenticados para "/"                        │
│  - Runtime: Edge (Vercel Edge Network)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA 2: SERVER COMPONENTS                  │
│  src/app/(app)/layout.tsx                                       │
│  - await auth() - valida Clerk NOVAMENTE                        │
│  - syncUserFromClerk() - sincroniza com DB                      │
│  - Redundância intencional (defense in depth)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CAMADA 3: tRPC                             │
│  src/server/api/trpc.ts                                         │
│  - publicProcedure (sem auth)                                   │
│  - protectedProcedure (auth + sync user)                        │
│  - hybridProcedure (auth opcional)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CAMADA 4: DATA ACCESS                         │
│  Routers: apiKeys.ts, webhooks.ts, whatsapp.ts                  │
│  - Verificam ownership: instance.orgId === user.orgId           │
│  - Defense in depth: mesmo com auth válido, verifica permissão  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Arquivos Impactados

| Arquivo | Tipo | Impacto |
|---------|------|---------|
| `src/middleware.ts` | Edge Middleware | **Renomear para proxy.ts** |
| `src/app/(app)/layout.tsx` | Server Component | Nenhum (já faz auth) |
| `src/server/api/trpc.ts` | tRPC Context | Nenhum (já faz auth) |
| `src/server/lib/user.ts` | Util | Nenhum |
| `src/app/api/ivy/upload/route.ts` | API Route | Nenhum (já faz auth) |
| `src/app/api/ivy/upload-audio/route.ts` | API Route | Nenhum (já faz auth) |
| `src/app/api/connect/share/route.ts` | API Route | Nenhum (já faz auth) |
| `src/components/auth/user-menu.tsx` | Client | Nenhum |
| `src/components/common/navbar.tsx` | Client | Nenhum |
| Routers tRPC (5 arquivos) | tRPC | Nenhum |

### 2.3 Rotas Públicas Atuais

```typescript
const isPublicRoute = createRouteMatcher([
  "/",                    // Landing page
  "/roadmap",             // Roadmap público
  "/changelog",           // Changelog público
  "/sso-callback",        // OAuth callback
  "/api/health",          // Health check
  "/api/trpc(.*)",        // tRPC (auth própria)
  "/api/webhooks(.*)",    // Webhooks externos
  "/api/public(.*)",      // APIs públicas
  "/api/internal(.*)",    // APIs internas
  "/api/v1(.*)",          // REST API (API key)
  "/api/stats(.*)",       // Stats públicas
]);
```

---

## 3. Diferenças Técnicas: middleware vs proxy

| Aspecto | middleware.ts (atual) | proxy.ts (novo) |
|---------|----------------------|-----------------|
| **Runtime** | Edge Runtime | Node.js Runtime |
| **Latência** | ~1-5ms (edge global) | ~10-50ms (cold start) |
| **Localização** | CDN edge (30+ locais) | Região específica |
| **Bibliotecas** | Limitadas (Edge API) | Todas do Node.js |
| **Custo Vercel** | Menor | Maior |
| **Propósito** | Routing + Auth checks | Apenas routing/proxy |

### 3.1 Impacto no Runtime

```
ANTES (Edge):
User → Vercel Edge (São Paulo) → middleware.ts → Origin Server
       └── ~2ms de latência ──┘

DEPOIS (Node.js):
User → Vercel Edge → Origin Server (região) → proxy.ts
                     └────── ~30ms de latência ──────┘
```

### 3.2 Compatibilidade Clerk

- `clerkMiddleware()` **funciona** com `proxy.ts`
- Não existe `clerkProxy` - usar o mesmo helper
- Documentação oficial do Clerk já menciona `proxy.ts` para Next.js 16+

---

## 4. Plano de Migração

### Fase 1: Preparação (Baixo risco)

**Objetivo:** Garantir que defense in depth está funcionando antes de mudar o proxy.

**Tarefas:**

1. [ ] Auditar `src/app/(app)/layout.tsx` - verificar se `auth()` redireciona corretamente
2. [ ] Auditar `src/server/api/trpc.ts` - verificar `protectedProcedure`
3. [ ] Auditar API routes - verificar se todas fazem `await auth()`
4. [ ] Criar testes E2E para rotas protegidas (opcional mas recomendado)

**Arquivos a verificar:**

```bash
# Server Components com auth
src/app/(app)/layout.tsx

# tRPC
src/server/api/trpc.ts

# API Routes protegidas
src/app/api/ivy/upload/route.ts
src/app/api/ivy/upload-audio/route.ts
src/app/api/connect/share/route.ts
```

### Fase 2: Migração do Arquivo (Médio risco)

**Objetivo:** Renomear middleware.ts para proxy.ts usando codemod oficial.

**Opção A: Codemod automático**

```bash
cd /home/pedro/dev/sandbox/livchat/app
npx @next/codemod@latest middleware-to-proxy ./src
```

**Opção B: Migração manual**

1. [ ] Renomear `src/middleware.ts` → `src/proxy.ts`
2. [ ] Alterar export default para named export:

```typescript
// ANTES: src/middleware.ts
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/", request.url).toString(),
    });
  }
});

// DEPOIS: src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/roadmap",
  "/changelog",
  "/sso-callback",
  "/api/health",
  "/api/trpc(.*)",
  "/api/webhooks(.*)",
  "/api/public(.*)",
  "/api/internal(.*)",
  "/api/v1(.*)",
  "/api/stats(.*)",
]);

export function proxy(request: NextRequest) {
  return clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect({
        unauthenticatedUrl: new URL("/", req.url).toString(),
      });
    }
  })(request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### Fase 3: Testes (Crítico)

**Objetivo:** Validar que a migração não quebrou nada.

**Testes manuais:**

1. [ ] Acessar `/` (landing) - deve funcionar sem login
2. [ ] Acessar `/roadmap` - deve funcionar sem login
3. [ ] Acessar `/app` (dashboard) - deve redirecionar para `/` se não logado
4. [ ] Fazer login e acessar `/app` - deve funcionar
5. [ ] Testar tRPC mutations protegidas
6. [ ] Testar upload de arquivos (`/api/ivy/upload`)
7. [ ] Verificar logs do Vercel para erros

**Testes automatizados (opcional):**

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test("protected routes redirect to home", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL("/");
});

test("public routes are accessible", async ({ page }) => {
  await page.goto("/roadmap");
  await expect(page).toHaveURL("/roadmap");
});
```

### Fase 4: Otimização (Opcional)

**Objetivo:** Seguir best practices do Next.js 16 para proxy.ts.

**Recomendação da Vercel:**

> "Keep proxy.ts thin. Do quick allow/deny, geofencing, A/B routing, early redirects. Don't validate JWTs, call databases, or run heavy logic here."

**Código otimizado (futuro):**

```typescript
// src/proxy.ts - VERSÃO LEVE
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = new Set([
  "/",
  "/roadmap",
  "/changelog",
  "/sso-callback",
]);

const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/trpc",
  "/api/webhooks",
  "/api/public",
  "/api/internal",
  "/api/v1",
  "/api/stats",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas - pass through
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // APIs públicas - pass through
  if (PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Rotas protegidas - verificar cookie de sessão
  const sessionCookie = request.cookies.get("__session");
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Auth válida será verificada no Server Component/tRPC
  return NextResponse.next();
}
```

**Nota:** Esta versão leve depende do `(app)/layout.tsx` e tRPC para validação real do JWT. É o padrão "defense in depth" recomendado.

### Fase 5: Cleanup (Baixo risco)

1. [ ] Remover arquivos obsoletos (se houver)
2. [ ] Atualizar documentação
3. [ ] Commit e deploy

---

## 5. Checklist de Execução

### Pré-migração

- [ ] Verificar versão do Next.js é 16.x
- [ ] Verificar versão do Clerk é 6.x+
- [ ] Backup do `middleware.ts` atual
- [ ] Ler changelog do Clerk para breaking changes

### Migração

- [ ] **Fase 1:** Auditar defense in depth existente
- [ ] **Fase 2:** Executar codemod ou migração manual
- [ ] **Fase 3:** Testar todas as rotas (públicas e protegidas)
- [ ] **Fase 4:** (Opcional) Otimizar proxy.ts
- [ ] **Fase 5:** Cleanup e documentação

### Pós-migração

- [ ] Monitorar logs do Vercel por 24h
- [ ] Verificar métricas de latência
- [ ] Documentar qualquer issue encontrado

---

## 6. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebrar auth em produção | Baixa | Alto | Testar em preview antes de merge |
| Aumento de latência | Alta | Médio | Medir antes/depois, aceitar trade-off |
| Clerk não funcionar com proxy | Muito baixa | Alto | Clerk já documenta suporte a proxy.ts |
| Cold starts mais lentos | Alta | Baixo | Configurar função warm-up se necessário |

---

## 7. Rollback

Se algo der errado:

```bash
# Reverter para middleware.ts
git checkout HEAD~1 -- src/middleware.ts
rm src/proxy.ts
git add .
git commit -m "Revert: volta para middleware.ts"
```

---

## 8. Decisão

### Recomendação: Adiar migração

**Motivos:**

1. O warning não é breaking - código funciona normalmente
2. Defense in depth já está implementado no LivChat
3. CVE-2025-29927 já está corrigido no Next.js 16
4. Clerk ainda não lançou documentação específica para proxy.ts otimizado
5. Impacto de latência pode ser negativo para UX

### Quando migrar:

- Quando Clerk lançar guia oficial de migração para Next.js 16
- Ou quando o warning virar breaking change
- Ou quando precisar de funcionalidades Node.js no proxy

---

## 9. Referências

### Segurança

- [CVE-2025-29927: Next.js Middleware Authorization Bypass | Datadog](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/)
- [Postmortem on Next.js Middleware bypass | Vercel](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass)

### Migração

- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16)
- [Upgrading to Version 16 | Next.js Docs](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [proxy.js File Convention | Next.js Docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

### Clerk

- [clerkMiddleware() Reference | Clerk Docs](https://clerk.com/docs/reference/nextjs/clerk-middleware)

### Best Practices

- [Complete Next.js Security Guide 2025 | TurboStarter](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices)
- [Why Next.js is Moving Away from Middleware | Build with Matija](https://www.buildwithmatija.com/blog/nextjs16-middleware-change)

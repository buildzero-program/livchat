# Plan 04.1-b: Dashboard Instances Widget (Dados Reais)

> **Status:** EM REVISÃO
> **Dependências:** plan-04.1 ✅, plan-04.1-c ✅
> **Objetivo:** Widget de instâncias com dados reais + rename demo → whatsapp
> **Metodologia:** TDD + Refactor incremental

---

## 1. Visão Geral

Este plano implementa o **InstancesWidget** do dashboard com:
- Dados reais via tRPC (não mock)
- Carousel para múltiplas instâncias
- Foto de perfil via Vercel Blob
- Rename de `demo` → `whatsapp` para clareza

### Escopo
- ✅ InstancesWidget (carousel com dados reais)
- ❌ MetricsWidget (próximo plano)
- ❌ QuotaWidget (próximo plano)
- ❌ ActivityWidget (precisa events table)
- ❌ QuickTestWidget (próximo plano)

---

## 2. Arquitetura Definida

### 2.1 Nomenclatura (Decisão)

| Antes | Depois | Motivo |
|-------|--------|--------|
| `demo.ts` | `whatsapp.ts` | Não é "demo", é o canal WhatsApp |
| `demoRouter` | `whatsappRouter` | Consistência |
| `useDemo.ts` | `useWhatsApp.ts` | Consistência |
| `demo.test.ts` | `whatsapp.test.ts` | Consistência |
| `ConnectionWidget` | `InstancesWidget` | Mostra instâncias, não só conexão |

### 2.2 Router Unificado

```
┌─────────────────────────────────────────────────────────────┐
│                    whatsapp.ts (router)                      │
│              Um router para LP E Dashboard                   │
├─────────────────────────────────────────────────────────────┤
│  PÚBLICOS (LP + Dashboard):                                  │
│  • whatsapp.status    - Status de UMA instância (device)    │
│  • whatsapp.send      - Enviar mensagem                     │
│  • whatsapp.validate  - Validar número                      │
│  • whatsapp.pairing   - Gerar pairing code                  │
│  • whatsapp.disconnect - Desconectar                        │
│                                                              │
│  NOVOS (Dashboard com auth):                                 │
│  • whatsapp.list      - Listar TODAS instâncias do user     │
│  • whatsapp.get       - Detalhes de uma instância           │
│  • whatsapp.updateAvatar - Buscar/salvar foto perfil        │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Diferenciação por Contexto

```typescript
// tRPC context já tem:
ctx.device    // Sempre presente (cookie)
ctx.user      // Só se autenticado (Clerk)

// Lógica interna diferencia:
if (ctx.user) {
  // Dashboard: busca instâncias da org do user
  return getOrganizationInstances(ctx.user.organizationId);
} else {
  // LP: busca instância do device
  return getDeviceInstance(ctx.device.id);
}
```

### 2.4 Desacoplamento de Provedor

```
whatsapp.ts (router)
       │
       ▼
instance.ts (lib) ──── Abstração, não sabe do provedor
       │
       ▼
providers/
├── wuzapi.ts      ← Atual (self-hosted)
├── evolution.ts   ← Futuro
├── baileys.ts     ← Futuro
└── cloud-api.ts   ← Futuro (Meta oficial)
```

Schema já suporta:
```typescript
providerType: "wuzapi" | "evolution" | ...
providerId: string
providerToken: string
```

---

## 3. Estado Atual vs Necessário

### 3.1 O Que JÁ Existe ✅

| Item | Arquivo | Status |
|------|---------|--------|
| Schema instances | `src/server/db/schema.ts` | ✅ Completo |
| Device tracking | `src/server/lib/device.ts` | ✅ Funciona |
| Instance CRUD | `src/server/lib/instance.ts` | ✅ Funciona |
| WuzAPI client | `src/server/lib/wuzapi.ts` | ✅ Funciona |
| Demo router | `src/server/api/routers/demo.ts` | ✅ Funciona (renomear) |
| useDemo hook | `src/hooks/useDemo.ts` | ✅ Funciona (renomear) |
| Conversão auto | `src/server/lib/user.ts` | ✅ `claimDeviceInstances` |
| Blob config | `.env` | ✅ `BLOB_READ_WRITE_TOKEN` |
| `getOrganizationInstances` | `src/server/lib/instance.ts` | ✅ Existe |

### 3.2 O Que FALTA Implementar

| Item | Arquivo | Status |
|------|---------|--------|
| Rename demo → whatsapp | Vários | ❌ Pendente |
| `whatsapp.list` procedure | `src/server/api/routers/whatsapp.ts` | ❌ Pendente |
| `whatsapp.get` procedure | `src/server/api/routers/whatsapp.ts` | ❌ Pendente |
| `whatsapp.updateAvatar` | `src/server/api/routers/whatsapp.ts` | ❌ Pendente |
| Blob storage helper | `src/server/lib/blob-storage.ts` | ❌ Pendente |
| InstancesWidget (carousel) | `src/components/dashboard/` | ❌ Pendente |
| useWhatsApp hook | `src/hooks/useWhatsApp.ts` | ❌ Pendente (rename) |

### 3.3 O Que NÃO Existe (e não precisa)

| Item | Motivo |
|------|--------|
| `anonymousSessions` table | Arquitetura mudou: devices → instances |
| `conversion.ts` router | Conversão é automática via `syncUserFromClerk` |

---

## 4. Fases de Implementação

### ═══════════════════════════════════════════════════════════════
### FASE 1: Rename demo → whatsapp
### ═══════════════════════════════════════════════════════════════

> **Objetivo:** Nomenclatura consistente antes de adicionar código

#### 1.1 Arquivos a Renomear

```bash
# Router
src/server/api/routers/demo.ts → whatsapp.ts

# Hook
src/hooks/useDemo.ts → useWhatsApp.ts

# Testes
tests/unit/server/api/routers/demo.test.ts → whatsapp.test.ts
```

#### 1.2 Imports a Atualizar

```typescript
// src/server/api/root.ts
- import { demoRouter } from "./routers/demo";
+ import { whatsappRouter } from "./routers/whatsapp";

export const appRouter = createTRPCRouter({
- demo: demoRouter,
+ whatsapp: whatsappRouter,
});

// src/hooks/useWhatsApp.ts (interno)
- api.demo.status
+ api.whatsapp.status

// src/app/(marketing)/page.tsx (LP)
- import { useDemo } from "~/hooks/useDemo";
+ import { useWhatsApp } from "~/hooks/useWhatsApp";

// Componentes que usam useDemo
// (buscar com grep e atualizar)
```

#### 1.3 Checklist Fase 1

- [ ] Renomear `demo.ts` → `whatsapp.ts`
- [ ] Renomear `demoRouter` → `whatsappRouter`
- [ ] Atualizar `root.ts`
- [ ] Renomear `useDemo.ts` → `useWhatsApp.ts`
- [ ] Atualizar imports no hook
- [ ] Renomear `demo.test.ts` → `whatsapp.test.ts`
- [ ] Atualizar imports nos testes
- [ ] Buscar/substituir `useDemo` em componentes
- [ ] Buscar/substituir `api.demo.` em componentes
- [ ] `bun test` passando
- [ ] `bun build` sem erros

---

### ═══════════════════════════════════════════════════════════════
### FASE 2: Backend - Procedures para Dashboard
### ═══════════════════════════════════════════════════════════════

> **Objetivo:** Criar procedures autenticadas para listar instâncias

#### 2.1 Criar `whatsapp.list`

```typescript
// src/server/api/routers/whatsapp.ts

/**
 * Lista todas instâncias do usuário autenticado
 * Usado no InstancesWidget (carousel)
 */
list: protectedProcedure.query(async ({ ctx }) => {
  const { user } = ctx;

  // Buscar org do user
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.ownerId, user.id),
  });

  if (!org) {
    return { instances: [], total: 0 };
  }

  // Buscar todas instâncias da org
  const instances = await getOrganizationInstances(org.id);

  // Para cada instância, buscar status atual no WuzAPI
  const instancesWithStatus = await Promise.all(
    instances.map(async (instance) => {
      const client = new WuzAPIClient({
        baseUrl: WUZAPI_BASE_URL,
        token: instance.providerToken,
      });

      try {
        const status = await client.getStatus();
        return {
          id: instance.id,
          name: instance.name,
          phoneNumber: extractPhoneFromJID(instance.whatsappJid),
          deviceName: instance.whatsappName ?? "WhatsApp Web",
          pictureUrl: instance.whatsappPictureUrl,
          connected: status.data.connected,
          loggedIn: status.data.loggedIn,
          connectedSince: instance.lastConnectedAt,
          messagesUsed: instance.messagesUsedToday,
          messagesLimit: org.maxMessagesPerDay,
        };
      } catch {
        return {
          id: instance.id,
          name: instance.name,
          phoneNumber: extractPhoneFromJID(instance.whatsappJid),
          deviceName: instance.whatsappName ?? "WhatsApp Web",
          pictureUrl: instance.whatsappPictureUrl,
          connected: false,
          loggedIn: false,
          connectedSince: null,
          messagesUsed: instance.messagesUsedToday,
          messagesLimit: org.maxMessagesPerDay,
        };
      }
    })
  );

  return {
    instances: instancesWithStatus,
    total: instances.length,
    maxInstances: org.maxInstances,
  };
}),
```

#### 2.2 Atualizar `whatsapp.status` (campos extras)

```typescript
// Adicionar ao response de whatsapp.status:
return {
  // Existentes
  connected,
  loggedIn,
  qrCode,
  jid,
  instanceId,
  apiKey,
  messagesUsed,
  messagesLimit,
  messagesRemaining,

  // NOVOS para widget
  connectedSince: instance.lastConnectedAt?.toISOString() ?? null,
  deviceName: instance.whatsappName ?? "WhatsApp Web",
  pictureUrl: instance.whatsappPictureUrl ?? null,
};
```

#### 2.3 Checklist Fase 2

- [ ] Criar `whatsapp.list` (protectedProcedure)
- [ ] Adicionar `connectedSince` ao `whatsapp.status`
- [ ] Adicionar `deviceName` ao `whatsapp.status`
- [ ] Adicionar `pictureUrl` ao `whatsapp.status`
- [ ] Testes para `whatsapp.list`
- [ ] `bun test` passando

---

### ═══════════════════════════════════════════════════════════════
### FASE 3: Backend - Avatar com Vercel Blob
### ═══════════════════════════════════════════════════════════════

> **Objetivo:** Buscar foto do WhatsApp e salvar no Vercel Blob

#### 3.1 Criar helper de Blob Storage

```typescript
// src/server/lib/blob-storage.ts

import { put, del } from "@vercel/blob";

/**
 * Faz upload de imagem de perfil para Vercel Blob
 */
export async function uploadProfilePicture(
  imageUrl: string,
  instanceId: string
): Promise<string> {
  // Baixar imagem do WhatsApp
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  // Upload para Vercel Blob
  const { url } = await put(
    `avatars/${instanceId}.jpg`,
    blob,
    { access: "public" }
  );

  return url;
}

/**
 * Deleta imagem de perfil do Vercel Blob
 */
export async function deleteProfilePicture(instanceId: string): Promise<void> {
  try {
    await del(`avatars/${instanceId}.jpg`);
  } catch {
    // Ignorar se não existir
  }
}
```

#### 3.2 Criar `whatsapp.updateAvatar`

```typescript
// src/server/api/routers/whatsapp.ts

/**
 * Busca foto de perfil do WhatsApp e salva no Blob
 */
updateAvatar: protectedProcedure
  .input(z.object({ instanceId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const instance = await getInstanceWithAccess(input.instanceId, {
      organizationId: ctx.user.organizationId,
    });

    if (!instance) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const { client } = instance;

    // Buscar avatar do WhatsApp
    const avatarRes = await client.getAvatar(instance.instance.whatsappJid);

    if (!avatarRes.data.URL) {
      return { success: false, pictureUrl: null };
    }

    // Upload para Vercel Blob
    const blobUrl = await uploadProfilePicture(
      avatarRes.data.URL,
      instance.instance.id
    );

    // Salvar URL no banco
    await db
      .update(instances)
      .set({ whatsappPictureUrl: blobUrl })
      .where(eq(instances.id, instance.instance.id));

    return { success: true, pictureUrl: blobUrl };
  }),
```

#### 3.3 Adicionar `getAvatar` ao WuzAPI Client

```typescript
// src/server/lib/wuzapi.ts

async getAvatar(jid: string): Promise<{
  code: number;
  data: { URL?: string; ID?: string };
}> {
  const phone = jid.replace("@s.whatsapp.net", "");
  return this.request("GET", "/user/avatar", { Phone: phone, Preview: false });
}
```

#### 3.4 Checklist Fase 3

- [ ] Instalar `@vercel/blob` (se não instalado)
- [ ] Criar `src/server/lib/blob-storage.ts`
- [ ] Adicionar `getAvatar` ao WuzAPIClient
- [ ] Criar `whatsapp.updateAvatar`
- [ ] Testes
- [ ] `bun test` passando

---

### ═══════════════════════════════════════════════════════════════
### FASE 4: Frontend - InstancesWidget com Carousel
### ═══════════════════════════════════════════════════════════════

> **Objetivo:** Widget com dados reais e navegação entre instâncias

#### 4.1 Criar InstancesWidget

```typescript
// src/components/dashboard/instances-widget.tsx

"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
// ... outros imports

export function InstancesWidget() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Buscar instâncias reais
  const { data, isLoading, error } = api.whatsapp.list.useQuery(undefined, {
    refetchInterval: 30000, // Polling 30s
  });

  // Mutations
  const disconnectMutation = api.whatsapp.disconnect.useMutation();
  const updateAvatarMutation = api.whatsapp.updateAvatar.useMutation();

  if (isLoading) return <InstancesWidgetSkeleton />;
  if (error) return <InstancesWidgetError error={error} />;
  if (!data?.instances.length) return <InstancesWidgetEmpty />;

  const instance = data.instances[currentIndex];
  const total = data.instances.length;

  const goNext = () => setCurrentIndex((i) => (i + 1) % total);
  const goPrev = () => setCurrentIndex((i) => (i - 1 + total) % total);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Conexão WhatsApp</CardTitle>

        {/* Badge com navegação */}
        {total > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Badge variant="secondary">{currentIndex + 1}/{total}</Badge>
            <Button variant="ghost" size="icon" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {instance.pictureUrl ? (
              <AvatarImage src={instance.pictureUrl} />
            ) : (
              <AvatarFallback>
                {getInitials(instance.phoneNumber)}
              </AvatarFallback>
            )}
          </Avatar>

          <div>
            <p className="text-xl font-bold">{instance.phoneNumber}</p>
            <p className="text-sm text-muted-foreground">{instance.deviceName}</p>
          </div>
        </div>

        {/* Status */}
        <div className="mt-4 flex items-center gap-2">
          <Badge variant={instance.loggedIn ? "default" : "destructive"}>
            {instance.loggedIn ? "Online" : "Offline"}
          </Badge>
          {instance.connectedSince && (
            <span className="text-sm text-muted-foreground">
              há {formatRelativeTime(new Date(instance.connectedSince))}
            </span>
          )}
        </div>

        {/* Ações */}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Reconectar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500"
            onClick={() => disconnectMutation.mutate({ instanceId: instance.id })}
          >
            <Power className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 4.2 Skeleton e Empty States

```typescript
// Skeleton para loading
function InstancesWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-20" />
      </CardContent>
    </Card>
  );
}

// Estado vazio
function InstancesWidgetEmpty() {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <Smartphone className="h-12 w-12 mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          Nenhuma instância conectada
        </p>
        <Button className="mt-4">
          Conectar WhatsApp
        </Button>
      </CardContent>
    </Card>
  );
}
```

#### 4.3 Atualizar Dashboard Page

```typescript
// src/app/(app)/app/page.tsx

- import { ConnectionWidget } from "~/components/dashboard/connection-widget";
+ import { InstancesWidget } from "~/components/dashboard/instances-widget";

// No grid:
- <ConnectionWidget />
+ <InstancesWidget />
```

#### 4.4 Checklist Fase 4

- [ ] Criar `InstancesWidget` com carousel
- [ ] Skeleton para loading
- [ ] Empty state
- [ ] Error state
- [ ] Navegação ← →
- [ ] Badge 1/N
- [ ] Avatar com fallback (iniciais)
- [ ] Botão reconectar
- [ ] Botão desconectar
- [ ] Polling 30s
- [ ] Atualizar `page.tsx`
- [ ] Remover `ConnectionWidget` (ou manter para LP?)
- [ ] `bun build` sem erros

---

### ═══════════════════════════════════════════════════════════════
### FASE 5: Testes e Refinamentos
### ═══════════════════════════════════════════════════════════════

#### 5.1 Testes E2E (Manual)

- [ ] LP: Conectar WhatsApp via QR
- [ ] LP: Enviar mensagem teste
- [ ] Signup: Criar conta
- [ ] Dashboard: Ver instância no widget
- [ ] Dashboard: Navegar carousel (se múltiplas)
- [ ] Dashboard: Desconectar
- [ ] Dashboard: Ver avatar (se disponível)

#### 5.2 Testes Unitários

- [ ] `whatsapp.list` retorna instâncias da org
- [ ] `whatsapp.list` retorna [] se org sem instâncias
- [ ] `whatsapp.updateAvatar` salva no blob
- [ ] Rename não quebrou testes existentes

---

## 5. Arquivos Modificados (Resumo)

| Arquivo | Ação | Fase |
|---------|------|------|
| `src/server/api/routers/demo.ts` | Renomear → `whatsapp.ts` | 1 |
| `src/server/api/root.ts` | Atualizar import | 1 |
| `src/hooks/useDemo.ts` | Renomear → `useWhatsApp.ts` | 1 |
| `tests/.../demo.test.ts` | Renomear → `whatsapp.test.ts` | 1 |
| `src/server/api/routers/whatsapp.ts` | Adicionar `list`, `updateAvatar` | 2 |
| `src/server/lib/wuzapi.ts` | Adicionar `getAvatar` | 3 |
| `src/server/lib/blob-storage.ts` | Criar | 3 |
| `src/components/dashboard/instances-widget.tsx` | Criar | 4 |
| `src/app/(app)/app/page.tsx` | Usar InstancesWidget | 4 |

---

## 6. Dependências

```bash
# Já instalado (verificar)
@vercel/blob

# Se não instalado
bun add @vercel/blob
```

---

## 7. Critérios de Conclusão

### Funcional
- [ ] Widget mostra instâncias reais
- [ ] Carousel navega entre múltiplas
- [ ] Avatar aparece (Vercel Blob)
- [ ] Status atualiza (polling 30s)
- [ ] Desconectar funciona

### Técnico
- [ ] Rename completo (demo → whatsapp)
- [ ] Zero referências a "demo" no código
- [ ] Testes passando
- [ ] Build sem erros
- [ ] TypeScript sem erros

---

## 8. Próximos Planos (Fora de Escopo)

| Plano | Descrição |
|-------|-----------|
| plan-04.2 | MetricsWidget + QuotaWidget |
| plan-04.3 | ActivityWidget (precisa events table) |
| plan-04.4 | QuickTestWidget integrado |
| plan-04.5 | QR Modal (criar instância pelo dashboard) |

---

## Changelog

- **2024-12-05**: Versão original (com anonymousSessions)
- **2024-12-07**: Refatorado completamente
  - Removido `anonymousSessions` (não existe)
  - Adicionado rename demo → whatsapp
  - Ajustado para arquitetura atual (devices → instances)
  - Escopo reduzido para InstancesWidget apenas
  - Fases reorganizadas

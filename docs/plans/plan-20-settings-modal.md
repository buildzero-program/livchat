# Plan 20: Settings Modal (Estilo Notion)

## Status: FASE 1 ✅ | FASE 2 ✅ CONCLUÍDA

Data: 2025-12-22

---

## 1. Visão Geral

### 1.1 Objetivo

Criar um modal de Settings simplificado estilo Notion com:
- Navegação lateral por seções (scroll-spy)
- UI/UX premium e polida
- Uma única API Key com máscara inteligente
- Funcionalidades de copiar, revelar e regenerar key

### 1.2 Estrutura Final (Simplificada)

```
┌───────────────────────────┬──────────────────────────────────────────────────────┐
│                           │                                                      │
│  👤 Pedro Nascimento      │              Perfil                                  │
│  ─────────────────────    │              ┌────────┐                              │
│                           │              │ Avatar │  Pedro Nascimento            │
│  👤 Perfil                │              └────────┘  pedro@buildzero.ai          │
│  🔑 Chave de API          │                                                      │
│  🎨 Aparência             │              ─────────────────────────────────────   │
│                           │                                                      │
│                           │              Chave de API                            │
│                           │              Use esta chave para autenticar...       │
│                           │                                                      │
│                           │              ┌─────────────────────┐ [👁] [📋]       │
│                           │              │ lc_live_abc1●●●xyz9 │                 │
│                           │              └─────────────────────┘                 │
│                           │              Criada em 15 de dezembro de 2024        │
│                           │                                                      │
│                           │              [🔄 Regenerar chave]                    │
│                           │                                                      │
│                           │              ─────────────────────────────────────   │
│                           │                                                      │
│                           │              Aparência                               │
│                           │              [☀️ Claro] [🌙 Escuro] [💻 Sistema]     │
│                           │                                                      │
└───────────────────────────┴──────────────────────────────────────────────────────┘
     260px                              Conteúdo centralizado (max 580px)
```

### 1.3 Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Navegação | Lateral com scroll-spy (não tabs) |
| API Keys | UMA única key (não lista) |
| Segurança | Removida (gerenciado pelo Clerk) |
| Aparência | 3 opções: Claro/Escuro/Sistema |
| Perfil | Read-only (avatar, nome, email do Clerk) |

---

## 2. Fase 1: UI com Mocks ✅ CONCLUÍDA

### 2.1 Arquivos Criados

```
src/components/settings/
├── settings-dialog.tsx     ✅ Modal completo (350 linhas)
├── api-key-display.tsx     ✅ Componente de API key (obsoleto, inline agora)
└── index.ts                ✅ Exports

src/hooks/
└── use-copy-to-clipboard.ts ✅ Hook de copiar
```

### 2.2 Arquivos Modificados

```
src/components/layout/user-dropdown-menu.tsx  ✅ Integrado com SettingsDialog
src/components/ui/dialog.tsx                  ✅ Overlay melhorado (bg-black/65 + blur)
```

### 2.3 Funcionalidades Implementadas

| Feature | Status |
|---------|--------|
| Modal estilo Notion (1000x650px) | ✅ |
| Navegação lateral (260px) | ✅ |
| Scroll-spy com IntersectionObserver | ✅ |
| Seção Perfil (mock do Clerk) | ✅ |
| Seção API Key com mask/reveal/copy | ✅ |
| Seção Aparência (tema funcional) | ✅ |
| Botão regenerar (placeholder) | ✅ |
| Overlay melhorado em todos dialogs | ✅ |

### 2.4 Specs de Layout

```css
/* Modal */
width: 1000px (max)
height: 650px

/* Sidebar */
width: 260px
padding: 24px (p-6)
background: muted/30

/* Content */
max-width: 580px
padding: 40px (p-10)
centered: flex justify-center
gap: 56px (space-y-14)
```

---

## 3. Fase 2: Integração Real 🔄 EM ANDAMENTO

### 3.1 Investigação Concluída ✅

#### 3.1.1 Schema da Tabela `apiKeys`

```typescript
// src/server/db/schema.ts (linhas 191-265)
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Ownership (sistema de claiming)
  organizationId: uuid("organization_id"),      // NULL = órfã, SET = claimed
  instanceId: uuid("instance_id").notNull(),    // 1:1 com instance

  // Token
  name: text("name").notNull().default("Default"),
  token: text("token").notNull().unique(),      // Formato: lc_live_xxx (40 chars)

  // Permissões
  scopes: text("scopes").array().default(['whatsapp:*']),
  isActive: boolean("is_active").notNull().default(true),

  // Timestamps
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Descoberta importante:** API Keys são **1:1 com Instances**. Cada instance do WhatsApp gera automaticamente uma key quando conecta.

#### 3.1.2 Endpoints Disponíveis

| Endpoint | Tipo | Descrição |
|----------|------|-----------|
| `apiKeys.list` | Query | Lista keys da org (tokens mascarados) |
| `apiKeys.revoke` | Mutation | Desativa key (soft delete) |
| `apiKeys.delete` | Mutation | Deleta permanentemente |

**⚠️ NÃO existe endpoint de "regenerar"** - keys são criadas automaticamente com instances.

#### 3.1.3 Formato do Token

```typescript
// Geração: src/server/lib/api-key.ts
function generateApiKeyToken(env: "live" | "test" = "live"): string {
  return `lc_${env}_${random32chars}`;  // Total: 40 caracteres
}

// Masking do backend (sempre retorna mascarado após criação)
// Formato: lc_live_****************************4d5e
```

#### 3.1.4 Relação Organization → Keys

```
Organization (1)
    └── Instances (N)
           └── API Key (1:1)
```

- Cada user tem 1 organization (no MVP)
- Organization pode ter N instances
- Cada instance gera exatamente 1 API key
- **Resultado:** pode haver múltiplas keys por organização

### 3.2 Dados Mock Atuais (a remover)

```typescript
const MOCK_API_KEY = {
  token: "lc_live_abc1defghijklmnopqrstuvwxyz1234xyz9",
  createdAt: new Date("2024-12-15"),
};
```

### 3.3 Integração Necessária

#### 3.3.1 Perfil (Clerk) - ✅ JÁ FUNCIONA
- `useUser()` do Clerk já está integrado
- Avatar, nome e email são reais

#### 3.3.2 API Key (tRPC) - 🔄 EM PROGRESSO

**Query necessária:**
```typescript
const { data, isLoading, isError, refetch } = api.apiKeys.list.useQuery(
  undefined,
  { enabled: open }  // Só buscar quando dialog aberto
);
```

**Retorno do endpoint:**
```typescript
Array<{
  id: string;
  name: string;
  maskedToken: string;        // lc_live_****...4d5e
  scopes: string[];
  instanceId: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}>
```

#### 3.3.3 Aparência (next-themes) - ✅ JÁ FUNCIONA
- `useTheme()` já está integrado
- Tema persiste corretamente

### 3.4 Ajustes de Design Necessários

| Item | Antes (Mock) | Depois (Real) |
|------|--------------|---------------|
| API Key | Uma key hardcoded | Primeira key ativa da lista |
| Botão Revelar | Mostra token completo | **Remover** (backend só retorna mascarado) |
| Botão Regenerar | Placeholder | **Remover** (não existe endpoint) |
| Empty State | N/A | Mensagem: "Conecte uma instância para gerar" |

---

## 4. Tarefas Fase 2

### 4.1 Investigação ✅ CONCLUÍDA
- [x] Ler `src/server/db/schema.ts` - tabela apiKeys
- [x] Ler `src/server/api/routers/apiKeys.ts` - endpoints
- [x] Entender relação org → instance → apiKey
- [x] Verificar se existe endpoint de regenerar → **NÃO EXISTE**

### 4.2 Implementação ✅ CONCLUÍDA
- [x] Adicionar `api.apiKeys.list.useQuery()` no settings-dialog
- [x] Remover `MOCK_API_KEY` e usar dados reais
- [x] Remover botão "Revelar" (token já vem mascarado)
- [x] Remover botão "Regenerar" (não existe endpoint)
- [x] Adicionar loading state (skeleton)
- [x] Adicionar error state com retry
- [x] Adicionar empty state (sem keys)

### 4.3 Polimento ✅ CONCLUÍDO
- [x] Skeleton loading durante fetch
- [x] Empty state com mensagem informativa
- [x] Toast feedback em ações (copiar)
- [ ] Considerar mostrar múltiplas keys (futuro - não necessário agora)

---

## 5. Checklist Final

### Fase 1: UI Mock ✅
- [x] Estrutura de pastas criada
- [x] settings-dialog.tsx completo
- [x] use-copy-to-clipboard.ts criado
- [x] Integração com user-dropdown-menu
- [x] Tema toggle funcional
- [x] Scroll-spy funcionando
- [x] Layout responsivo

### Fase 2: Integração ✅
- [x] Dados reais do Clerk (perfil)
- [x] Tema funcional (next-themes)
- [x] Investigação da API (schema, router, relações)
- [x] API Key real via `api.apiKeys.list`
- [x] Loading state (skeleton)
- [x] Error state (retry button)
- [x] Empty state (sem keys)
- [x] ~~Regenerar key~~ → **REMOVIDO** (não existe endpoint)

---

## 6. Referências

| Recurso | Path |
|---------|------|
| Settings Dialog | `src/components/settings/settings-dialog.tsx` |
| Copy Hook | `src/hooks/use-copy-to-clipboard.ts` |
| User Dropdown | `src/components/layout/user-dropdown-menu.tsx` |
| Dialog UI | `src/components/ui/dialog.tsx` |
| API Keys Schema | `src/server/db/schema.ts` (linhas 191-265) |
| API Keys Router | `src/server/api/routers/apiKeys.ts` |
| API Keys Lib | `src/server/lib/api-key.ts` |
| tRPC Client | `src/trpc/react.tsx` |

---

**Status Final:** ✅ PLANO CONCLUÍDO

Implementação completa do Settings Modal estilo Notion com:
- Perfil via Clerk (real)
- API Key via tRPC (real)
- Tema via next-themes (real)
- Loading/Error/Empty states

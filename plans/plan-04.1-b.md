# Plan 04.1-b: Dashboard Real Data + Conversão Demo → Conta Real

> **Status:** FASES 1-8 CONCLUÍDAS | FASE 9 PENDENTE (QR Modal)
> **Dependências:** plan-04.1 ✅ (Fases 0-5 completas)
> **Objetivo:** Conectar widgets do dashboard com dados reais E implementar conversão de sessão anônima
> **Metodologia:** TDD + Refactor incremental

---

## 1. Visão Geral

Este plano tem **DUAS PARTES CRÍTICAS**:

### Parte A: Connection Widget (Fases 1-5) ✅
Widget do dashboard que mostra instâncias reais do usuário.

### Parte B: Conversão Demo → Conta Real (Fases 6-8) 🔴 CORE
O **elo perdido** que converte visitantes da demo em usuários pagantes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLUXO COMPLETO DE CONVERSÃO                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Visitante acessa LP                                                     │
│  2. Cria sessão anônima (demo.getSession)                                   │
│  3. Conecta WhatsApp via QR code                                            │
│  4. Testa envio de mensagens (5 msgs grátis)                                │
│  5. Clica "Criar conta" → Signup via Clerk                                  │
│  6. [CONVERSÃO] Sessão anônima → Instance real ← IMPLEMENTAR               │
│  7. User logado vê instância no dashboard                                   │
│  8. Continua usando o MESMO número WhatsApp                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. O Problema Atual (GAP)

```
┌─────────────────────────────────────────────────────────────────┐
│  ATUAL (BUG - sem conversão)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Visitante testa demo ✅                                      │
│  2. Conecta WhatsApp ✅                                          │
│  3. Faz signup via Clerk ✅                                      │
│  4. [FALTA] Nada acontece ❌                                     │
│  5. User vê 0 instâncias no dashboard ❌                         │
│  6. Precisa reconectar WhatsApp do zero! ❌                      │
│                                                                  │
│  RESULTADO: Péssima UX, usuário abandona                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Schema Relevante

### anonymousSessions (sessão da demo)
```typescript
{
  id: uuid,
  token: string,              // "sess_abc..."
  wuzapiUserId: string,       // "anon_xyz" - credencial WuzAPI
  wuzapiToken: string,        // "lc_123" - credencial WuzAPI
  whatsappJid: string | null, // Preenchido ao conectar
  isConnected: boolean,       // Status atual

  // CAMPOS DE CONVERSÃO (existem mas não são usados!)
  convertedToUserId: uuid | null,  // NULL → user.id após conversão
  convertedAt: timestamp | null,   // NULL → NOW() após conversão
}
```

### instances (instância real do usuário)
```typescript
{
  id: uuid,
  organizationId: uuid,       // Link com org do usuário
  name: string,               // "WhatsApp Principal"
  wuzapiUserId: string,       // Reutilizado da sessão anônima
  wuzapiToken: string,        // Reutilizado da sessão anônima
  whatsappJid: string | null, // Copiado da sessão anônima
  status: string,             // 'connected' | 'disconnected'
}
```

---

## 4. Fases de Implementação

### ═══════════════════════════════════════════════════════════════
### PARTE A: CONNECTION WIDGET (Concluída)
### ═══════════════════════════════════════════════════════════════

### Fase 1: Refatorar UI (Mock) ✅
> **Objetivo:** Nova UI com carousel, sem mudar dados

- [x] Criar `InstancesWidget` (novo nome, mais preciso)
- [x] Implementar navegação com setas (← →)
- [x] Mostrar badge "1/N"
- [x] Placeholder para foto (iniciais por enquanto)
- [x] Manter mock data para validar visual

**Arquivos:**
- `src/components/dashboard/instances-widget.tsx` (novo)
- `src/lib/mock-dashboard.ts` (atualizar mock)

---

### Fase 2: Backend - Avatar no WuzAPI Client ✅
> **Objetivo:** Buscar foto de perfil do WhatsApp

- [x] Adicionar `getAvatar(phone)` no WuzAPIClient
- [x] Testar endpoint `/user/avatar`
- [x] Retornar URL da imagem

**Arquivos:**
- `src/server/lib/wuzapi.ts`

---

### Fase 3: Backend - Vercel Blob Storage ✅
> **Objetivo:** Salvar foto no Vercel Blob

- [x] Instalar `@vercel/blob`
- [x] Criar helper `uploadProfilePicture(imageUrl, instanceId)`
- [x] Baixar imagem do WhatsApp → Upload para Blob
- [x] Retornar URL permanente

**Arquivos:**
- `src/server/lib/blob-storage.ts` (novo)
- `src/env.js` (adicionar BLOB_READ_WRITE_TOKEN)

---

### Fase 4: Backend - Router Integration ✅
> **Objetivo:** Buscar/salvar foto ao conectar

- [x] Criar `instances.listForDashboard` (otimizado para widget)
- [x] Criar `instances.updateAvatar` para buscar e salvar foto
- [x] Salvar `whatsappPictureUrl` no banco

**Arquivos:**
- `src/server/api/routers/instances.ts`

---

### Fase 5: Frontend - Conectar com Real ✅
> **Objetivo:** Substituir mock por dados reais

- [x] Usar tRPC `instances.listForDashboard`
- [x] Polling do status (30s)
- [x] Loading states (Skeleton)
- [x] Error handling
- [x] Mutations para connect/disconnect

**Arquivos:**
- `src/components/dashboard/instances-widget.tsx`

---

### ═══════════════════════════════════════════════════════════════
### PARTE B: CONVERSÃO DEMO → CONTA REAL (Core Feature)
### ═══════════════════════════════════════════════════════════════

### Fase 6: Backend - Router de Conversão ✅
> **Objetivo:** Criar endpoint para converter sessão anônima em instância real

- [x] Criar `src/server/api/routers/conversion.ts`
- [x] Implementar `conversion.convertAnonymousSession`
- [x] Adicionar router no `src/server/api/root.ts`
- [x] Testes unitários

**Endpoint:** `conversion.convertAnonymousSession`
```typescript
// Input
{ sessionToken: string }

// Lógica:
// 1. Buscar sessão anônima pelo token
// 2. Validar: não convertida, não expirada
// 3. Obter organização do usuário logado
// 4. Criar Instance reutilizando credenciais WuzAPI
// 5. Marcar sessão como convertida (convertedToUserId, convertedAt)
// 6. Retornar nova instância

// Output
{ success: boolean, instance: Instance }
```

**Arquivos:**
- `src/server/api/routers/conversion.ts` (novo)
- `src/server/api/root.ts` (adicionar router)
- `tests/unit/server/api/routers/conversion.test.ts` (novo)

---

### Fase 7: Frontend - Trigger de Conversão ✅
> **Objetivo:** Disparar conversão automaticamente após signup

- [x] Detectar signup bem-sucedido (Clerk useUser)
- [x] Verificar se há sessão anônima no localStorage
- [x] Chamar `conversion.convertAnonymousSession`
- [x] Mostrar feedback visual ("Importando sua sessão...")
- [x] Redirecionar para dashboard com instância

**Opções de implementação:**

**Opção A: Hook no useDemo**
```typescript
// src/hooks/useDemo.ts
useEffect(() => {
  if (isSignedIn && sessionToken && !isConverted) {
    convertMutation.mutate({ sessionToken });
  }
}, [isSignedIn, sessionToken]);
```

**Opção B: Página de callback**
```typescript
// src/app/sso-callback/page.tsx
// Após Clerk completar auth, verificar e converter
```

**Opção C: Middleware no dashboard**
```typescript
// src/app/app/page.tsx
// Ao acessar dashboard, verificar sessão pendente
```

**Arquivos:**
- `src/hooks/useDemo.ts` ou `src/hooks/useConversion.ts` (novo)
- `src/app/app/page.tsx` (trigger)
- `src/components/conversion-modal.tsx` (feedback visual)

---

### Fase 8: Atualizar Demo - Salvar Status no Banco ✅
> **Objetivo:** Garantir que `whatsappJid` e `isConnected` são salvos

Atualmente o `demo.getSessionStatus` busca status do WuzAPI mas **não salva no banco**.
Precisamos atualizar `anonymousSessions` quando conecta.

- [x] Atualizar `demo.getSessionStatus` para salvar no banco
- [x] Salvar `whatsappJid` quando conecta
- [x] Salvar `isConnected: true` quando loggedIn
- [x] Testes

**Arquivos:**
- `src/server/api/routers/demo.ts` (atualizar getSessionStatus)

---

### Fase 9: QR Code Modal (Dashboard)
> **Objetivo:** Permitir conectar nova instância pelo dashboard

- [ ] Modal com QR code grande
- [ ] Auto-refresh do QR (expira a cada ~20s)
- [ ] Detectar conexão e fechar modal
- [ ] Feedback visual de sucesso
- [ ] Botão "Criar Instância" conectado ao mutation

**Arquivos:**
- `src/components/dashboard/qr-code-modal.tsx` (novo)
- `src/components/dashboard/instances-widget.tsx`

---

## 5. Fluxo de Dados (Conversão)

```
ANTES DO LOGIN (Sessão Anônima):
┌──────────────────────────────────────────┐
│ anonymousSessions                         │
├──────────────────────────────────────────┤
│ token: "sess_abc..."                     │
│ wuzapiUserId: "anon_xyz"                 │
│ wuzapiToken: "lc_123"                    │
│ whatsappJid: "5585886..."                │
│ isConnected: true                        │
│ convertedToUserId: NULL  ← NÃO CONVERTIDA│
└──────────────────────────────────────────┘

                    ↓ [SIGNUP + CONVERSÃO]

APÓS CONVERSÃO:
┌──────────────────────────────────────────┐
│ anonymousSessions (ATUALIZADO)           │
├──────────────────────────────────────────┤
│ convertedToUserId: "user-456" ← MARCADA  │
│ convertedAt: NOW()                       │
└──────────────────────────────────────────┘
                    +
┌──────────────────────────────────────────┐
│ instances (NOVO REGISTRO)                │
├──────────────────────────────────────────┤
│ organizationId: "org-456"                │
│ wuzapiUserId: "anon_xyz"  ← REUTILIZADO  │
│ wuzapiToken: "lc_123"     ← REUTILIZADO  │
│ whatsappJid: "5585886..."                │
│ status: "connected"                      │
│ name: "WhatsApp (importado)"             │
└──────────────────────────────────────────┘

    → User vê instância no dashboard! 🎉
```

---

## 6. Endpoints WuzAPI Utilizados

| Endpoint | Método | Uso |
|----------|--------|-----|
| `/admin/users` | POST | Criar instância WuzAPI |
| `/admin/users/{id}` | DELETE | Deletar instância |
| `/session/status` | GET | Status connected/loggedIn |
| `/session/connect` | POST | Iniciar conexão |
| `/session/logout` | POST | Desconectar |
| `/session/qr` | GET | QR code para escanear |
| `/user/avatar` | GET | Foto de perfil |

---

## 7. Critérios de Conclusão

### Parte A (Widget) ✅
- [x] Widget mostra instâncias reais do usuário
- [x] Navegação com setas funciona (se múltiplas)
- [x] Foto de perfil aparece (do Vercel Blob)
- [x] Status atualiza em tempo real (polling)
- [x] Mutations para connect/disconnect

### Parte B (Conversão) ✅
- [x] Endpoint `conversion.convertAnonymousSession` funciona
- [x] Sessão anônima é marcada como convertida
- [x] Instance é criada com credenciais WuzAPI reutilizadas
- [x] Conversão dispara automaticamente após signup
- [x] User vê instância no dashboard imediatamente
- [x] WhatsApp continua conectado (mesmo número)
- [x] Testes passando
- [x] Build sem erros

---

## 8. Prioridade de Execução

```
1. [URGENTE] Fase 8 - Salvar status no banco (demo.ts)
   └─ Sem isso, whatsappJid fica NULL e conversão perde dados

2. [URGENTE] Fase 6 - Router de conversão
   └─ Core da feature

3. [ALTA] Fase 7 - Trigger frontend
   └─ UX de conversão automática

4. [MÉDIA] Fase 9 - QR Code Modal
   └─ Permite criar instância pelo dashboard (sem demo)
```

---

## 9. Estimativa de Complexidade

| Fase | Complexidade | Arquivos | Descrição |
|------|-------------|----------|-----------|
| 6 | Média | 3 | Router de conversão |
| 7 | Média | 3-4 | Trigger frontend |
| 8 | Baixa | 1 | Atualizar demo.ts |
| 9 | Média | 2 | QR Code modal |

---

## 10. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Sessão expirada antes de converter | Mostrar aviso "sua sessão expira em X dias" |
| WuzAPI instância desconectada | Verificar status antes de converter, reconectar se necessário |
| Conflito de instância (já existe) | Verificar se wuzapiUserId já está em instances |
| Limite de instâncias do plano | Verificar antes de converter, mostrar upgrade |

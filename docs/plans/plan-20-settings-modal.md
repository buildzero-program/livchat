# Plan 20: Settings Modal (Estilo Notion)

## Status: PENDENTE

Data: 2025-12-22

---

## 1. Visão Geral

### 1.1 Objetivo

Criar um modal de Settings completo estilo Notion/Linear com:
- Navegação lateral por seções
- UI/UX premium e polida
- API Keys com máscara inteligente (mostrar 4 primeiros + 4 últimos)
- Funcionalidades de copiar e revelar key

### 1.2 Referência Visual (Notion)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ╳                                                                   │
├───────────────┬─────────────────────────────────────────────────────┤
│               │                                                      │
│  ○ Conta      │  Conta                                               │
│  ┄┄┄┄┄┄┄┄┄┄┄  │  ─────────────────────────────────────────────────   │
│    Pedro      │  ┌──────┐                                            │
│               │  │Avatar│   Nome                                     │
│  ★ Preferênc  │  └──────┘   [Pedro Nascimento___________]            │
│  ⚙ Notificaç  │                                                      │
│               │             Crie seu retrato                         │
│  ─────────────│                                                      │
│  Espaço de    │  Segurança da conta                                  │
│  trabalho     │  ─────────────────────────────────────────────────   │
│               │                                                      │
│  ★ Geral      │  E-mail                                              │
│  ↓ Importaçõe │  pedro@livchat.ai                  [Alterar e-mail]  │
│               │                                                      │
└───────────────┴─────────────────────────────────────────────────────┘
```

### 1.3 Abordagem em 2 Fases

| Fase | Objetivo | Entrega |
|------|----------|---------|
| **Fase 1** | UI Completa com Mocks | Visual perfeito para avaliação |
| **Fase 2** | Integração Real | Funcionalidade completa |

---

## 2. Seções do Modal

### 2.1 Estrutura de Navegação

```
CONTA
├── Perfil            # Avatar, nome, email
└── Segurança         # Trocar senha (via Clerk)

API
├── Chaves de API     # Lista de keys, copiar, revelar, revogar

PREFERÊNCIAS
└── Aparência         # Tema (claro/escuro/sistema)
```

### 2.2 Detalhamento por Seção

#### 📋 Perfil
- **Avatar** com preview e link "Crie seu retrato" (abre Clerk)
- **Nome** (read-only, vem do Clerk)
- **E-mail** (read-only + botão "Alterar" abre Clerk)

#### 🔐 Segurança
- **Alterar senha** (botão abre Clerk user management)
- **Verificação em duas etapas** (link para Clerk)
- **Excluir conta** (botão destructive com confirmação)

#### 🔑 Chaves de API (Foco Principal)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Chaves de API                                                       │
│  ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│  As chaves são criadas automaticamente ao conectar uma instância    │
│  WhatsApp. Use-as para autenticar chamadas à API.                   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  📱 Meu WhatsApp Pessoal                                        ││
│  │  lc_live_abc1 ●●●●●●●●●●●●●●●●●●●●●●●●●●●● xyz9                 ││
│  │                                                                  ││
│  │  Criada em 15/12/2024 • Última uso: há 2 horas                  ││
│  │                                                    [👁] [📋] [🗑]││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  📱 WhatsApp Suporte                                            ││
│  │  lc_live_def2 ●●●●●●●●●●●●●●●●●●●●●●●●●●●● wxy8                 ││
│  │                                                                  ││
│  │  Criada em 20/12/2024 • Nunca usada                             ││
│  │                                                    [👁] [📋] [🗑]││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- **Máscara inteligente**: `lc_live_abc1` + `●●●●...●●●●` + `xyz9` (4 primeiros após prefixo + 4 últimos)
- **Revelar (👁)**: Toggle mostra/esconde key completa
- **Copiar (📋)**: Copia key completa com toast de feedback
- **Revogar (🗑)**: Soft delete com confirmação

#### 🎨 Aparência
- **Tema**: Radio group (Claro / Escuro / Sistema)
- Preview visual de cada tema

---

## 3. Componentes Necessários

### 3.1 Componentes Existentes (shadcn/ui)

| Componente | Status | Uso |
|------------|--------|-----|
| `Dialog` | ✅ Instalado | Container do modal |
| `Button` | ✅ Instalado | Ações |
| `Input` | ✅ Instalado | Campos editáveis |
| `Avatar` | ✅ Instalado | Foto do usuário |
| `Tabs` | ✅ Instalado | Navegação lateral (adaptado) |
| `ScrollArea` | ✅ Instalado | Scroll na lista de keys |
| `Separator` | ✅ Instalado | Divisores de seção |
| `RadioGroup` | ⚠️ Verificar | Seletor de tema |
| `Tooltip` | ⚠️ Verificar | Hints nos botões |

### 3.2 Componentes a Criar

```
src/components/settings/
├── settings-dialog.tsx           # Modal principal
├── settings-nav.tsx              # Navegação lateral
├── settings-section.tsx          # Container de seção
├── settings-row.tsx              # Linha label + value + action
├── sections/
│   ├── profile-section.tsx       # Seção Perfil
│   ├── security-section.tsx      # Seção Segurança
│   ├── api-keys-section.tsx      # Seção Chaves de API
│   └── appearance-section.tsx    # Seção Aparência
├── api-key-card.tsx              # Card individual de API key
└── api-key-display.tsx           # Input mascarado com reveal/copy
```

### 3.3 Hooks a Criar

```
src/hooks/
├── use-copy-to-clipboard.ts      # Copy com feedback
└── use-settings-dialog.ts        # Estado global do dialog (zustand ou context)
```

---

## 4. Fase 1: UI com Mocks

### 4.1 Objetivo

Criar toda a interface visual com dados mockados para avaliação de UI/UX antes de integrar com o backend.

### 4.2 Dados Mock

```typescript
// src/components/settings/mock-data.ts

export const mockUser = {
  id: "user_123",
  name: "Pedro Nascimento",
  email: "pedro@livchat.ai",
  avatarUrl: "https://github.com/pedronascimento.png",
};

export const mockApiKeys = [
  {
    id: "key_1",
    name: "Meu WhatsApp Pessoal",
    token: "lc_live_abc1defghijklmnopqrstuvwxyz1234xyz9",
    instanceName: "WhatsApp Pessoal",
    createdAt: new Date("2024-12-15"),
    lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    isActive: true,
  },
  {
    id: "key_2",
    name: "WhatsApp Suporte",
    token: "lc_live_def2ghijklmnopqrstuvwxyz5678wxy8",
    instanceName: "Suporte Técnico",
    createdAt: new Date("2024-12-20"),
    lastUsedAt: null,
    isActive: true,
  },
];
```

### 4.3 Tarefas Fase 1

#### 4.3.1 Setup Base
- [ ] Instalar `RadioGroup` do shadcn/ui (se necessário)
- [ ] Instalar `Tooltip` do shadcn/ui (se necessário)
- [ ] Criar estrutura de pastas `src/components/settings/`

#### 4.3.2 Componentes Base
- [ ] Criar `settings-dialog.tsx` - Modal com layout split (nav + content)
- [ ] Criar `settings-nav.tsx` - Navegação lateral com ícones
- [ ] Criar `settings-section.tsx` - Wrapper de seção com título
- [ ] Criar `settings-row.tsx` - Layout flexbox (label + value + action)

#### 4.3.3 Seções com Mock
- [ ] Criar `profile-section.tsx` - Avatar + nome + email (mock)
- [ ] Criar `security-section.tsx` - Botões placeholder
- [ ] Criar `api-keys-section.tsx` - Lista de keys mock
- [ ] Criar `appearance-section.tsx` - Tema toggle funcional

#### 4.3.4 Componente de API Key
- [ ] Criar `api-key-card.tsx` - Card visual da key
- [ ] Criar `api-key-display.tsx` - Input com máscara + reveal + copy
- [ ] Criar `use-copy-to-clipboard.ts` - Hook de copiar

#### 4.3.5 Integração UI
- [ ] Criar `use-settings-dialog.ts` - Estado do dialog (open/close)
- [ ] Atualizar `user-dropdown-menu.tsx` - Abrir dialog ao clicar em Configurações
- [ ] Testar responsividade mobile

### 4.4 Design Specs

#### Cores e Espaçamentos
```css
/* Modal */
--settings-width: min(94vw, 800px);
--settings-max-height: 85vh;

/* Navegação */
--nav-width: 220px;
--nav-item-height: 36px;
--nav-item-radius: 6px;

/* Seções */
--section-gap: 32px;
--row-gap: 16px;

/* API Key Card */
--card-padding: 16px;
--card-radius: 8px;
--card-border: 1px solid hsl(var(--border));
```

#### Animações
```css
/* Dialog enter */
animation: dialog-in 200ms ease-out;

/* Nav item hover */
transition: background-color 150ms ease;

/* Reveal key */
transition: opacity 200ms ease;
```

---

## 5. Fase 2: Integração Real

### 5.1 Objetivo

Conectar a UI com dados reais do Clerk (usuário) e tRPC (API keys).

### 5.2 Tarefas Fase 2

#### 5.2.1 Integração Clerk (Perfil)
- [ ] Substituir mock por `useUser()` do Clerk
- [ ] Implementar "Alterar e-mail" → `user.createEmailAddress()`
- [ ] Implementar "Crie seu retrato" → redirect Clerk user profile

#### 5.2.2 Integração tRPC (API Keys)
- [ ] Usar `api.apiKeys.list.useQuery()` para listar keys
- [ ] Implementar revelar key (já vem masked do backend, precisa endpoint novo?)
- [ ] Implementar copiar key completa
- [ ] Implementar revogar key → `api.apiKeys.revoke.useMutation()`
- [ ] Implementar deletar key → `api.apiKeys.delete.useMutation()`

#### 5.2.3 Integração Tema
- [ ] Usar `useTheme()` do next-themes (já funciona)
- [ ] Persistir preferência

#### 5.2.4 Polimento
- [ ] Loading states (Skeleton)
- [ ] Error states
- [ ] Empty states
- [ ] Toast de feedback para todas ações
- [ ] Animações de transição

### 5.3 Endpoints tRPC Necessários

| Endpoint | Status | Descrição |
|----------|--------|-----------|
| `apiKeys.list` | ✅ Existe | Lista keys masked |
| `apiKeys.revoke` | ✅ Existe | Soft delete |
| `apiKeys.delete` | ✅ Existe | Hard delete |
| `apiKeys.reveal` | ❌ **CRIAR** | Retorna token completo |

#### Novo Endpoint: `apiKeys.reveal`

```typescript
// src/server/api/routers/apiKeys.ts

reveal: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const key = await ctx.db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.id, input.id),
        eq(apiKeys.organizationId, ctx.user.organizationId)
      ),
    });

    if (!key) throw new TRPCError({ code: "NOT_FOUND" });

    return { token: key.token }; // Token completo, não masked
  }),
```

---

## 6. Arquivos Impactados

### Fase 1 (Criar)
```
src/components/settings/
├── settings-dialog.tsx
├── settings-nav.tsx
├── settings-section.tsx
├── settings-row.tsx
├── mock-data.ts
├── sections/
│   ├── profile-section.tsx
│   ├── security-section.tsx
│   ├── api-keys-section.tsx
│   └── appearance-section.tsx
├── api-key-card.tsx
└── api-key-display.tsx

src/hooks/
├── use-copy-to-clipboard.ts
└── use-settings-dialog.ts
```

### Fase 1 (Modificar)
```
src/components/layout/user-dropdown-menu.tsx  # Abrir dialog
```

### Fase 2 (Modificar)
```
src/server/api/routers/apiKeys.ts  # Adicionar endpoint reveal
src/components/settings/sections/profile-section.tsx  # Integrar Clerk
src/components/settings/sections/api-keys-section.tsx  # Integrar tRPC
```

---

## 7. UX Details

### 7.1 Máscara de API Key

```typescript
function maskApiKey(token: string): string {
  // token: "lc_live_abc1defghijklmnopqrstuvwxyz1234xyz9"
  // output: "lc_live_abc1 ●●●●●●●●●●●●●●●●●●●●●●●●●●●● xyz9"

  const prefix = "lc_live_";
  const withoutPrefix = token.slice(prefix.length);
  const first4 = withoutPrefix.slice(0, 4);
  const last4 = withoutPrefix.slice(-4);
  const maskedMiddle = "●".repeat(Math.max(0, withoutPrefix.length - 8));

  return `${prefix}${first4} ${maskedMiddle} ${last4}`;
}
```

### 7.2 Copy Feedback

```typescript
// Hook
const { copy, copied } = useCopyToClipboard();

// UI
<Button onClick={() => copy(token)}>
  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
</Button>

// Toast
toast.success("Chave copiada para a área de transferência");
```

### 7.3 Keyboard Shortcuts

| Atalho | Ação |
|--------|------|
| `Esc` | Fechar modal |
| `↑/↓` | Navegar seções |
| `Enter` | Selecionar seção |

### 7.4 Mobile Behavior

Em telas < 768px:
- Navegação vira tabs horizontais no topo
- Ou drawer lateral que fecha ao selecionar

---

## 8. Testes

### 8.1 Teste Visual (Fase 1)
- [ ] Modal abre corretamente
- [ ] Navegação funciona
- [ ] Todas seções renderizam
- [ ] Tema toggle funciona
- [ ] API key mask/reveal/copy funciona (com mock)
- [ ] Responsivo mobile

### 8.2 Teste Integração (Fase 2)
- [ ] Dados do Clerk carregam
- [ ] Lista de API keys carrega
- [ ] Revelar key funciona
- [ ] Copiar key funciona
- [ ] Revogar key funciona
- [ ] Toast de feedback aparece

---

## 9. Referências

### Arquivos de Referência

| Recurso | Path |
|---------|------|
| SettingsPanel (base) | `/home/pedro/dev/sandbox/buildzero/references/saas-template/src/lib/ui/settings/settings-panel.tsx` |
| UserDropdownMenu | `/home/pedro/dev/sandbox/livchat/app/src/components/layout/user-dropdown-menu.tsx` |
| Dialog existente | `/home/pedro/dev/sandbox/livchat/app/src/components/ui/dialog.tsx` |
| API Keys schema | `/home/pedro/dev/sandbox/livchat/app/src/server/db/schema.ts:191-265` |
| API Keys router | `/home/pedro/dev/sandbox/livchat/app/src/server/api/routers/apiKeys.ts` |

### Design Inspiration
- Notion Settings Modal (referência visual)
- Linear Settings
- Vercel Dashboard Settings

---

## 10. Checklist Final

### Fase 1: UI Mock
- [ ] Estrutura de pastas criada
- [ ] Componentes base implementados
- [ ] Todas seções com dados mock
- [ ] API key display com mask/reveal/copy
- [ ] Integração com user-dropdown-menu
- [ ] Tema toggle funcional
- [ ] Responsivo testado
- [ ] **ENTREGA: Modal bonito para avaliação**

### Fase 2: Integração
- [ ] Dados reais do Clerk
- [ ] Dados reais de API keys (tRPC)
- [ ] Endpoint `apiKeys.reveal` criado
- [ ] Todas ações funcionais
- [ ] Loading/error states
- [ ] Testes passando
- [ ] **ENTREGA: Modal 100% funcional**

---

## 11. Estimativas

| Fase | Complexidade | Arquivos |
|------|--------------|----------|
| Fase 1 | Média | ~12 arquivos novos |
| Fase 2 | Baixa | ~4 arquivos modificados |

---

**Próximo passo:** Iniciar Fase 1, criando a estrutura de componentes e o modal com dados mockados.

# Plan 03 - Layout Interno do App

> **Baseado em:** `docs/system-design.md`
> **Referências visuais:** Copilot Edge (chat sidebar), ClickUp (mobile + user nav), PagBank (AI button)
> **Referências de código:**
> - `github.com/pedrohnas0/livchat-front` (sidebar premium, OAuth popup, middleware)
> - `/home/pedro/dev/sandbox/buildzero/core-agent` (ports/adapters, estrutura modular)

---

## Status de Implementação

| Item | Status | Notas |
|------|--------|-------|
| Auth Modal (social only) | ✅ | Design login-03, 11 testes |
| UserMenu próprio | ✅ | Substitui UserButton do Clerk |
| OAuth popup + fallback | ✅ | Implementado no navbar |
| Middleware proteção | ✅ | Redireciona para `/` se não autenticado |
| Layout (app) protection | ✅ | Verifica auth server-side |
| Sidebar premium | ✅ | Collapsible, keyboard shortcut, cookie persistence |
| AI Chat | ❌ | Falta implementar |
| Bottom Nav mobile | ❌ | Falta implementar |

## Objetivo

Criar o layout base da área logada (`/app`) com:
- **Layout responsivo único** que adapta desktop ↔ mobile
- **Desktop:** Sidebar + Chat AI resizável + Header com user nav
- **Mobile:** Header simplificado + Bottom nav + FAB para AI (menos recursos)
- **Auth:** Modal sobre a LP (componentes próprios, não Clerk UI)
- **Mockado:** Sem integração backend, só estrutura visual

---

## Decisões de Arquitetura

| Aspecto | Decisão |
|---------|---------|
| **Rota principal** | `/app` (não `/dashboard`) |
| **Mobile** | Layout responsivo (não rota separada `/m/`) |
| **Recursos mobile** | Subset do desktop (menos features) |
| **AI Chat estado** | Context global (presente em todas as páginas) |
| **Theme** | Adaptativo (inicia com preferência do sistema) |
| **Auth UI** | Modal sobre LP (componentes próprios) |
| **Clerk** | Só backend (hooks: `useAuth`, `useUser`, `useSignIn`) - **ZERO UI do Clerk** |
| **OAuth** | Popup mode com fallback para redirect (ver seção abaixo) |
| **Auth method** | **Apenas social login** (Google/GitHub) - sem email/password |
| **Páginas internas** | Não criar ainda - só links na navbar |

---

## OAuth Popup Strategy

> **Referência:** Implementação funcional em `github.com/pedrohnas0/livchat-front`

### Padrão de Implementação

```tsx
async function handleOAuth(provider: "oauth_github" | "oauth_google") {
  if (!isLoaded || !signIn) return;

  try {
    const redirectUrl = `${window.location.origin}/sso-callback`;

    // 1. Abre popup ANTES de chamar o Clerk
    const popup = window.open(
      "",
      "livchat_oauth",
      "width=480,height=640,menubar=no,toolbar=no,location=no,status=no"
    );

    // 2. Fallback se popup bloqueado
    if (!popup) {
      await signIn.authenticateWithRedirect({
        strategy: provider,
        redirectUrl,
        redirectUrlComplete: "/app",
      });
      return;
    }

    // 3. Usa popup mode passando a referência da janela
    await signIn.authenticateWithPopup({
      strategy: provider,
      redirectUrl,
      redirectUrlComplete: "/app",
      popup,
    });

    router.replace("/app");
  } catch (err) {
    console.error("OAuth error", err);
  }
}
```

### Componentes do Clerk Permitidos vs Proibidos

| ✅ Permitido (hooks/backend) | ❌ Proibido (UI) |
|------------------------------|------------------|
| `useAuth()` | `<UserButton />` |
| `useUser()` | `<SignIn />` |
| `useSignIn()` | `<SignUp />` |
| `useSignUp()` | `<UserProfile />` |
| `useClerk()` | `<SignedIn />` (substituir por hook) |
| `auth()` (server) | `<SignedOut />` (substituir por hook) |
| `currentUser()` (server) | Qualquer componente visual |

### Substituições Necessárias

```tsx
// ❌ ANTES (Clerk UI)
<SignedIn>
  <UserButton afterSignOutUrl="/" />
</SignedIn>

// ✅ DEPOIS (UI própria)
const { isSignedIn, user } = useAuth();
{isSignedIn && <UserMenu user={user} />}
```

---

## Insights dos Projetos de Referência

### Comparativo de Arquitetura

| Feature | livchat-front | core-agent | livchat/app |
|---------|---------------|------------|-------------|
| **Auth middleware** | ✅ | ✅ | ❌ FALTA |
| **Layout protection** | ✅ async server | ✅ middleware | ❌ FALTA |
| **Sidebar collapsible** | ✅ | ✅ | ❌ |
| **Sidebar resizable** | ✅ `useSidebarResize` | ✅ SidebarRail | ❌ |
| **Cookie persistence** | ✅ | ✅ | ❌ |
| **Mobile bottom-nav** | ❌ | ✅ | ❌ |
| **UserMenu próprio** | ✅ | ✅ | ✅ |
| **OAuth popup** | ✅ | ❌ (redirect) | ✅ |
| **i18n** | ✅ (3 langs) | ✅ | ❌ |
| **Accent colors** | ✅ (9 cores) | ✅ | ❌ |

### Padrão de Proteção de Rotas (livchat-front)

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login",
  "/register",
  "/sso-callback",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

```typescript
// app/home/layout.tsx (server component)
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomeLayout({ children }) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  return <Providers>{children}</Providers>;
}
```

### Padrão de Sidebar Premium (livchat-front)

**Hook `useSidebarResize`:**
- Drag-to-resize estilo VS Code
- Auto-collapse abaixo de threshold
- Persistência em cookies
- Suporte bidirecional (left/right)

```typescript
// Uso
const { dragRef, isDragging, handleMouseDown } = useSidebarResize({
  minResizeWidth: 200,
  maxResizeWidth: 400,
  autoCollapseThreshold: 180,
});
```

### Estrutura de Componentes (core-agent)

```
src/
├── components/
│   ├── ui/              # shadcn primitives (30+)
│   ├── layout/          # Navigation & structural
│   │   ├── app-sidebar.tsx
│   │   ├── desktop-header.tsx
│   │   ├── mobile-header.tsx
│   │   └── bottom-nav.tsx
│   └── [feature]/       # Feature-specific
│
├── lib/
│   ├── auth/            # Ports/Adapters pattern
│   │   ├── ports/auth-port.ts
│   │   ├── adapters/clerk-adapter.ts
│   │   ├── components/
│   │   └── hooks/use-auth.ts
│   ├── theme/
│   └── i18n/
│
├── hooks/               # Global hooks
│   ├── use-mobile.ts
│   └── use-channels.ts
│
└── modules/             # Feature modules (futuro)
    └── tasks/
        ├── components/
        ├── hooks/
        ├── services/
        └── tests/
```

---

## Metodologia: TDD

```
1. ESCREVER TESTE   ← criar .test.tsx
2. ESCREVER CÓDIGO  ← implementar componente
3. EXECUTAR TESTE   ← bun test
4. REFATORAR        ← melhorar
```

**Estrutura de testes:**
```
tests/
├── unit/
│   ├── components/
│   │   ├── dashboard/    # Sidebar, header, etc
│   │   ├── ai-chat/      # Chat components
│   │   └── auth/         # Login/signup forms
│   ├── hooks/            # useAiChat, useTheme
│   └── contexts/         # AiChatContext
└── int/                  # Integração (futuro)
```

---

## Estrutura de Rotas

```
src/app/
├── (marketing)/              # LP existente ✅
│   ├── layout.tsx
│   └── page.tsx
├── (app)/                    # NOVO - Área logada
│   ├── layout.tsx            # Layout responsivo + AI Chat Context
│   └── app/
│       └── page.tsx          # Página placeholder (link funciona)
└── layout.tsx                # Root (theme provider, etc)
```

**Nota:** Outras páginas (`/app/instances`, `/app/settings`, etc) serão criadas em planos futuros. Por enquanto, só os links na sidebar.

---

## Estrutura de Componentes

```
src/components/
├── layout/                       # Layout compartilhado
│   ├── app-sidebar.tsx          # Sidebar desktop (hidden mobile)
│   ├── sidebar-nav.tsx          # Itens de navegação
│   ├── header.tsx               # Header responsivo
│   ├── user-nav.tsx             # Avatar + dropdown (canto direito)
│   ├── bottom-nav.tsx           # Bottom nav mobile (hidden desktop)
│   ├── theme-toggle.tsx         # Toggle dark/light/system
│   └── page-container.tsx       # Container com borda de seção
├── ai-chat/                      # Chat AI (responsivo)
│   ├── ai-chat-provider.tsx     # Context global
│   ├── ai-chat-panel.tsx        # Painel desktop (resizável)
│   ├── ai-chat-sheet.tsx        # Sheet mobile (full height)
│   ├── ai-chat-trigger.tsx      # Botão + animação balões
│   ├── ai-chat-messages.tsx     # Lista de mensagens
│   └── ai-chat-input.tsx        # Input de mensagem
├── auth/                         # Auth UI própria
│   ├── auth-modal.tsx           # Modal container
│   ├── login-form.tsx           # Form de login
│   ├── signup-form.tsx          # Form de signup
│   └── social-buttons.tsx       # Google/GitHub buttons
└── ui/                          # shadcn (existente)
```

---

## Componentes shadcn/ui

### Já instalados (15)
```
avatar, badge, button, card, dialog, dropdown-menu, input,
progress, scroll-area, separator, sheet, sidebar, skeleton, tabs, tooltip
```

### A instalar (4)
```bash
cd sandbox/livchat/app

bunx shadcn@latest add resizable   # AI Chat panel resize
bunx shadcn@latest add textarea    # AI Chat input
bunx shadcn@latest add form        # Auth forms
bunx shadcn@latest add label       # Form labels
```

### Mapeamento de uso

| Componente do App | shadcn/ui |
|-------------------|-----------|
| App Sidebar | `sidebar`, `separator`, `tooltip`, `badge` |
| Sidebar Nav | `sidebar` (SidebarMenu, SidebarMenuItem, etc) |
| User Nav | `avatar`, `dropdown-menu`, `separator`, `badge` |
| Header | `button` (sidebar trigger) |
| Bottom Nav | `button` (custom styling) |
| AI Chat Panel | `resizable`, `scroll-area`, `separator` |
| AI Chat Sheet | `sheet`, `scroll-area` |
| AI Chat Messages | `avatar`, `scroll-area` |
| AI Chat Input | `textarea`, `button` |
| AI Chat Trigger | `button` + Framer Motion |
| Auth Modal | `dialog` |
| Login/Signup Form | `form`, `input`, `label`, `button` |
| Social Buttons | `button` (variant outline) |
| Theme Toggle | `dropdown-menu`, `button` |
| Page Container | styled div (rounded border) |

---

## Tarefas

### Fase 0: Setup ✅ (Parcial)

- [x] 0.1 Instalar dependências shadcn (`resizable`, `textarea`, `form`, `label`)
- [x] 0.2 Criar estrutura de pastas de testes
- [ ] 0.3 Criar mock data para AI chat (`lib/mock-ai-chat.ts`)
- [ ] 0.4 Configurar theme provider com next-themes

**Teste:** `tests/unit/mock-ai-chat.test.ts`

---

### ⚠️ Fase 0.5: Route Protection (CRÍTICO)

> **Bug atual:** `/app` é acessível sem login. Isso é um problema de segurança.

#### 0.5.1 Middleware de Proteção

**Arquivo:** `src/middleware.ts` **NOVO**

**Requisitos:**
- Usar `clerkMiddleware` do `@clerk/nextjs/server`
- Definir rotas públicas: `/`, `/sso-callback`, `/api/trpc(.*)`, `/api/webhooks(.*)`
- Proteger todas as outras rotas
- Redirecionar não-autenticados para `/` (LP com modal)

**Implementação:**
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sso-callback",
  "/api/trpc(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

---

#### 0.5.2 Layout Protection (Server-side)

**Arquivo:** `src/app/(app)/layout.tsx` **UPDATE**

**Requisitos:**
- Converter para async server component
- Verificar `userId` via `auth()` do Clerk
- Redirecionar para `/` se não autenticado

**Implementação:**
```typescript
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return <>{children}</>;
}
```

---

#### 0.5.3 SSO Callback Update

**Arquivo:** `src/app/sso-callback/page.tsx` **UPDATE**

**Requisitos:**
- Redirecionar para `/app` após autenticação bem-sucedida
- Manter `AuthenticateWithRedirectCallback`

**Implementação atual já está OK** - apenas verificar se `redirectUrlComplete` aponta para `/app`

---

#### Ordem de Execução (0.5)

```
1. Criar middleware.ts
2. Atualizar (app)/layout.tsx
3. Testar fluxo:
   - Acessar /app deslogado → redireciona para /
   - Fazer login → redireciona para /app
   - Popup OAuth funciona
4. Build + testes
```

**Teste manual:**
1. Abrir aba anônima
2. Acessar `localhost:3000/app`
3. Deve redirecionar para `/`
4. Clicar "Entrar" → Modal abre
5. Fazer OAuth → Popup abre
6. Após login → Vai para `/app`

---

### Fase 1: Theme System

#### 1.1 Theme Provider

**Arquivo:** Atualizar `app/layout.tsx`

**Requisitos:**
- Usar `next-themes` (já compatível com shadcn)
- Default: `system` (preferência do dispositivo)
- Opções: `light`, `dark`, `system`
- Persistir escolha em localStorage

**Teste:** `tests/unit/hooks/useTheme.test.ts`
```typescript
describe('Theme', () => {
  it('defaults to system preference')
  it('persists user choice')
  it('applies correct class to html')
})
```

---

#### 1.2 Theme Toggle

**Arquivo:** `components/layout/theme-toggle.tsx`

**Requisitos:**
- Dropdown com 3 opções: Light, Dark, System
- Ícone que reflete tema atual (Sun/Moon/Monitor)
- Posição: dentro do user-nav dropdown

**Teste:** `tests/unit/components/layout/theme-toggle.test.tsx`
```typescript
describe('ThemeToggle', () => {
  it('renders current theme icon')
  it('shows dropdown with 3 options')
  it('changes theme on selection')
})
```

---

### Fase 2: AI Chat Context

#### 2.1 AI Chat Provider (Context Global)

**Arquivo:** `components/ai-chat/ai-chat-provider.tsx`

**Requisitos:**
- Context com estado global do chat
- Estado: `isOpen`, `messages`, `isLoading`
- Actions: `toggle`, `open`, `close`, `sendMessage`, `clearMessages`
- Persistir mensagens em localStorage
- Mock de resposta AI (delay 1-2s)
- Disponível em TODAS as páginas do `/app`

**Interface:**
```typescript
interface AiChatContext {
  // Estado
  isOpen: boolean
  messages: Message[]
  isLoading: boolean

  // Actions
  toggle: () => void
  open: () => void
  close: () => void
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}
```

**Teste:** `tests/unit/contexts/ai-chat-context.test.tsx`
```typescript
describe('AiChatProvider', () => {
  it('provides default closed state')
  it('toggles open state')
  it('adds user message')
  it('simulates AI response with delay')
  it('persists messages to localStorage')
  it('clears messages')
  it('loads messages from localStorage on mount')
})
```

---

#### 2.2 Hook useAiChat

**Arquivo:** `hooks/useAiChat.ts`

**Requisitos:**
- Wrapper simples para o context
- Throw error se usado fora do provider

**Teste:** `tests/unit/hooks/useAiChat.test.ts`
```typescript
describe('useAiChat', () => {
  it('returns context values')
  it('throws if used outside provider')
})
```

---

### Fase 3: Componentes de Layout Desktop

#### 3.1 User Nav ✅ IMPLEMENTADO

**Arquivo:** `components/auth/user-menu.tsx`

**Status:** Já implementado como `UserMenu` em `components/auth/`

**Features implementadas:**
- [x] Avatar com iniciais (fallback) ou imagem do Clerk
- [x] Dropdown menu com nome e email
- [x] Links para Perfil e Configurações
- [x] Botão de logout via `signOut({ redirectUrl: "/" })`
- [x] 7 testes passando

**Pendente:**
- [ ] Badge de plano (FREE/STARTER/SCALE)
- [ ] Theme toggle no dropdown

---

#### 3.2 App Sidebar (Premium)

**Arquivo:** `components/layout/app-sidebar.tsx`

**Referência:** `livchat-front/components/app-sidebar.tsx` + `core-agent/components/layout/app-sidebar.tsx`

**Requisitos Base:**
- Usar componentes do shadcn `sidebar`
- Header: Logo LivChat (link para `/app`)
- Content: SidebarNav com grupos
- Footer: UserMenu (avatar compacto)
- Collapsible: icon-only mode (`Cmd+B`)
- Hidden em mobile (`md:flex hidden`)

**Requisitos Premium (dos projetos de referência):**
- **Drag-to-resize:** Arrastar borda para redimensionar (estilo VS Code)
- **Auto-collapse:** Colapsa automaticamente abaixo de threshold
- **Cookie persistence:** Salvar largura/estado em cookies
- **SidebarRail:** Barra de resize visual
- **Keyboard shortcut:** `Cmd+B` / `Ctrl+B` para toggle

**Estrutura shadcn Sidebar:**
```tsx
<SidebarProvider>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      {/* Logo */}
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={...}>
              <Link href="/app">Dashboard</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      {/* UserMenu compacto */}
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
  <SidebarInset>
    {/* Main content */}
  </SidebarInset>
</SidebarProvider>
```

**Hook opcional `useSidebarResize` (inspirado no livchat-front):**
```typescript
interface UseSidebarResizeOptions {
  minResizeWidth?: number;    // default: 200
  maxResizeWidth?: number;    // default: 400
  autoCollapseThreshold?: number; // default: 180
}

const { dragRef, isDragging, handleMouseDown } = useSidebarResize(options);
```

**Teste:** `tests/unit/components/layout/app-sidebar.test.tsx`
```typescript
describe('AppSidebar', () => {
  it('renders logo in header')
  it('renders navigation items')
  it('is hidden on mobile')
  it('collapses to icons on toggle')
})
```

---

#### 3.3 Sidebar Nav

**Arquivo:** `components/layout/sidebar-nav.tsx`

**Requisitos:**
- Recebe array de items como prop
- Cada item: `{ title, href, icon, badge? }`
- Highlight item ativo baseado em pathname
- Suporte a grupos (separator entre eles)

**Items (placeholder - ajustar depois):**
```typescript
const navItems = [
  { title: 'Dashboard', href: '/app', icon: LayoutDashboard },
  { title: 'Instâncias', href: '/app/instances', icon: Server },
  { title: 'Webhooks', href: '/app/webhooks', icon: Webhook },
  // separator
  { title: 'Docs', href: '/app/docs', icon: BookOpen },
  { title: 'Settings', href: '/app/settings', icon: Settings },
]
```

**Teste:** `tests/unit/components/layout/sidebar-nav.test.tsx`
```typescript
describe('SidebarNav', () => {
  it('renders all nav items')
  it('shows correct icons')
  it('highlights active item')
  it('renders badges when provided')
})
```

---

#### 3.4 Header

**Arquivo:** `components/layout/header.tsx`

**Requisitos:**
- Layout: `[SidebarTrigger] [spacer] [AiChatTrigger] [UserNav]`
- SidebarTrigger: hidden em mobile
- Altura fixa: 64px desktop, 56px mobile
- Border bottom sutil
- Responsivo

**Teste:** `tests/unit/components/layout/header.test.tsx`
```typescript
describe('Header', () => {
  it('renders sidebar trigger on desktop')
  it('hides sidebar trigger on mobile')
  it('renders AI chat trigger')
  it('renders user nav on the right')
})
```

---

#### 3.5 Page Container

**Arquivo:** `components/layout/page-container.tsx`

**Requisitos:**
- Container com borda arredondada (como modal interno)
- Background: `bg-background` (diferente do layout `bg-muted`)
- Border: `border rounded-xl`
- Padding interno
- Overflow scroll se necessário
- Props: `children`, `className?`

**Teste:** `tests/unit/components/layout/page-container.test.tsx`
```typescript
describe('PageContainer', () => {
  it('renders children')
  it('has rounded border')
  it('accepts custom className')
})
```

---

### Fase 4: Componentes de Layout Mobile

#### 4.1 Bottom Nav

**Arquivo:** `components/layout/bottom-nav.tsx`

**Requisitos:**
- Visible apenas em mobile (`md:hidden flex`)
- 4-5 items com ícones + labels pequenos
- Item ativo destacado (cor primary)
- Safe area padding para iPhone
- Posição fixed bottom
- Botão central destacado (FAB style) para ação primária

**Items (placeholder):**
```typescript
const mobileNavItems = [
  { title: 'Início', href: '/app', icon: Home },
  { title: 'Instâncias', href: '/app/instances', icon: Server },
  // Centro: ação primária ou +
  { title: 'Webhooks', href: '/app/webhooks', icon: Webhook },
  { title: 'Mais', href: '/app/more', icon: MoreHorizontal },
]
```

**Teste:** `tests/unit/components/layout/bottom-nav.test.tsx`
```typescript
describe('BottomNav', () => {
  it('is hidden on desktop')
  it('renders nav items with icons')
  it('highlights active item')
  it('has safe area padding')
})
```

---

#### 4.2 AI FAB (Mobile)

**Arquivo:** integrado no `ai-chat-trigger.tsx`

**Requisitos:**
- Em mobile: botão floating no canto inferior direito
- Posição: acima do bottom nav (bottom-20)
- Clica abre AI Sheet (não panel)
- Mesmo botão, comportamento diferente por breakpoint

---

### Fase 5: AI Chat Components

#### 5.1 AI Chat Trigger

**Arquivo:** `components/ai-chat/ai-chat-trigger.tsx`

**Requisitos:**
- Botão com ícone Sparkles
- Desktop: no header, abre panel
- Mobile: FAB floating, abre sheet
- Animação de balõezinhos (Framer Motion):
  - Trigger: 30s após mount OU 60s de inatividade
  - 2-3 bolhas pequenas saindo do botão
  - Salvar `hasSeenAiHint` em localStorage
  - Não repetir se já visto

**Teste:** `tests/unit/components/ai-chat/ai-chat-trigger.test.tsx`
```typescript
describe('AiChatTrigger', () => {
  it('renders button with sparkles icon')
  it('calls toggle on click')
  it('shows bubble animation after delay')
  it('does not show animation if already seen')
  it('positions as FAB on mobile')
})
```

---

#### 5.2 AI Chat Panel (Desktop)

**Arquivo:** `components/ai-chat/ai-chat-panel.tsx`

**Requisitos:**
- Usar `ResizablePanelGroup` horizontal
- Posição: entre sidebar e main content
- Largura: min 320px, max 600px, default 400px
- Resize handle visível no hover
- Persistir largura em localStorage
- Header: "AI Assistant" + botão fechar (X)
- Body: AiChatMessages
- Footer: AiChatInput

**Teste:** `tests/unit/components/ai-chat/ai-chat-panel.test.tsx`
```typescript
describe('AiChatPanel', () => {
  it('renders when open')
  it('is hidden when closed')
  it('has resize handle')
  it('persists width to localStorage')
  it('has header with close button')
  it('renders messages and input')
})
```

---

#### 5.3 AI Chat Sheet (Mobile)

**Arquivo:** `components/ai-chat/ai-chat-sheet.tsx`

**Requisitos:**
- Usar `Sheet` do shadcn (side="bottom" ou "right")
- Altura: quase full screen (90vh)
- Header: "AI Assistant" + botão fechar
- Body: AiChatMessages (scroll)
- Footer: AiChatInput (fixed bottom)
- Drag to close

**Teste:** `tests/unit/components/ai-chat/ai-chat-sheet.test.tsx`
```typescript
describe('AiChatSheet', () => {
  it('renders as sheet')
  it('has close button')
  it('renders messages and input')
  it('closes on overlay click')
})
```

---

#### 5.4 AI Chat Messages

**Arquivo:** `components/ai-chat/ai-chat-messages.tsx`

**Requisitos:**
- Lista de mensagens do context
- User message: alinhado direita, bg primary
- AI message: alinhado esquerda, bg muted, com avatar
- Auto-scroll para última mensagem
- Empty state: "Como posso ajudar?"
- Loading state: typing indicator (3 dots animados)

**Teste:** `tests/unit/components/ai-chat/ai-chat-messages.test.tsx`
```typescript
describe('AiChatMessages', () => {
  it('renders empty state when no messages')
  it('renders user messages on right')
  it('renders AI messages on left with avatar')
  it('auto-scrolls to bottom')
  it('shows loading indicator when typing')
})
```

---

#### 5.5 AI Chat Input

**Arquivo:** `components/ai-chat/ai-chat-input.tsx`

**Requisitos:**
- Textarea auto-resize (1-4 linhas)
- Botão enviar (ícone Send)
- Placeholder: "Pergunte algo..."
- Enter: envia (se não shift)
- Shift+Enter: nova linha
- Disabled durante loading
- Focus automático ao abrir chat

**Teste:** `tests/unit/components/ai-chat/ai-chat-input.test.tsx`
```typescript
describe('AiChatInput', () => {
  it('renders textarea')
  it('renders send button')
  it('submits on Enter')
  it('adds newline on Shift+Enter')
  it('disables during loading')
  it('clears after submit')
})
```

---

### Fase 6: Auth UI (Componentes Próprios)

> **IMPORTANTE:** Apenas login social (Google/GitHub). Sem formulários de email/password.

#### 6.1 Auth Modal (Social Only) ✅ IMPLEMENTADO

**Arquivo:** `components/auth/auth-modal.tsx`

**Requisitos:**
- [x] Dialog shadcn com design premium (login-03 style)
- [x] Header com logo + título + descrição
- [x] Botões Google e GitHub como ação principal
- [x] Badge "login seguro"
- [x] Links para Termos e Privacidade
- [x] Loading state durante auth
- [x] Acessibilidade (sr-only DialogTitle/Description)
- [ ] **OAuth Popup** (pendente - atualmente usa redirect)

**OAuth Handler (a implementar):**
```tsx
async function handleOAuth(provider: "oauth_github" | "oauth_google") {
  const popup = window.open("", "livchat_oauth", "width=480,height=640,...");

  if (!popup) {
    // Fallback: redirect
    await signIn.authenticateWithRedirect({...});
    return;
  }

  // Popup mode
  await signIn.authenticateWithPopup({ strategy: provider, popup, ... });
  router.replace("/app");
}
```

**Teste:** `tests/unit/components/auth/auth-modal.test.tsx` ✅ (11 testes passando)

---

#### 6.2 User Menu (Substituir UserButton do Clerk)

**Arquivo:** `components/auth/user-menu.tsx` **NOVO**

**Requisitos:**
- Avatar com iniciais (fallback) ou imagem do user
- Dropdown com:
  - Header: Nome + Email
  - Separator
  - Perfil (link)
  - Configurações (link)
  - Separator
  - Sair (action via `useClerk().signOut()`)
- **NENHUM** componente visual do Clerk
- Usar `useUser()` para dados do usuário

**Estrutura:**
```tsx
import { useUser, useClerk } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { DropdownMenu, ... } from "~/components/ui/dropdown-menu";

export function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar>
          <AvatarImage src={user?.imageUrl} />
          <AvatarFallback>{getInitials(user?.fullName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/* Header com nome e email */}
        {/* Links de navegação */}
        {/* Botão de logout */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Teste:** `tests/unit/components/auth/user-menu.test.tsx`
```typescript
describe('UserMenu', () => {
  it('renders avatar with user initials')
  it('shows avatar image when available')
  it('opens dropdown on click')
  it('shows user name and email in header')
  it('has logout button that calls signOut')
  it('has profile and settings links')
})
```

---

#### 6.3 Navbar Auth Updates

**Arquivo:** `components/common/navbar.tsx`

**Substituições necessárias:**
```tsx
// ❌ REMOVER
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
<SignedOut>...</SignedOut>
<SignedIn>
  <UserButton afterSignOutUrl="/" />
</SignedIn>

// ✅ SUBSTITUIR POR
import { useAuth, useUser } from "@clerk/nextjs";
import { UserMenu } from "~/components/auth/user-menu";

const { isSignedIn } = useAuth();
{!isSignedIn && (
  <Button onClick={() => setAuthModalOpen(true)}>Entrar</Button>
)}
{isSignedIn && (
  <>
    <Link href="/app"><Button>Dashboard</Button></Link>
    <UserMenu />
  </>
)}
```

---

#### ~~6.4 Social Buttons~~ (Removido - integrado no AuthModal)

Os botões sociais agora são parte direta do AuthModal, não um componente separado.
O arquivo `social-buttons.tsx` existe mas não é mais usado pelo AuthModal.

---

### Fase 7: Layout Principal

#### 7.1 App Layout

**Arquivo:** `app/(app)/layout.tsx`

**Requisitos:**
- Wrap com `AiChatProvider`
- Estrutura desktop:
  ```
  [Sidebar] | [AI Panel?] + [Header + PageContainer]
  ```
- Estrutura mobile:
  ```
  [Header]
  [Content]
  [BottomNav]
  [AI FAB]
  ```
- Usar `ResizablePanelGroup` para AI Panel + Main
- `SidebarProvider` do shadcn
- Proteger com middleware Clerk (mas UI própria)

**Teste:** `tests/unit/app/layout.test.tsx`
```typescript
describe('AppLayout', () => {
  it('renders sidebar on desktop')
  it('renders bottom nav on mobile')
  it('provides AI chat context')
  it('renders AI panel when open (desktop)')
  it('renders AI sheet when open (mobile)')
})
```

---

#### 7.2 App Home Page

**Arquivo:** `app/(app)/app/page.tsx`

**Requisitos:**
- Página placeholder simples
- Título: "Dashboard" (ou similar)
- Conteúdo: pode ser vazio ou texto placeholder
- Prova que o layout funciona

**Teste:** `tests/unit/app/home-page.test.tsx`
```typescript
describe('AppHomePage', () => {
  it('renders page title')
  it('is wrapped in page container')
})
```

---

### Fase 8: Integração na Landing Page

#### 8.1 Atualizar Navbar LP

**Arquivo:** `components/common/navbar.tsx` (update)

**Requisitos:**
- Botão "Entrar" abre AuthModal (login)
- Botão "Começar grátis" abre AuthModal (signup)
- Remover links para `/sign-in`, `/sign-up` do Clerk

---

#### 8.2 Auth Modal Trigger

**Requisitos:**
- Estado no URL: `?auth=login` ou `?auth=signup`
- Detectar param e abrir modal automaticamente
- Limpar param ao fechar

---

### Fase 9: Refinamentos

- [ ] 9.1 Testar fluxo completo desktop
- [ ] 9.2 Testar fluxo completo mobile
- [ ] 9.3 Verificar transições e animações
- [ ] 9.4 Keyboard navigation (a11y)
- [ ] 9.5 Screen reader testing
- [ ] 9.6 Performance check (bundle size)
- [ ] 9.7 Code review e cleanup

---

## Resumo de Arquivos

### Novos Componentes (16)
```
components/
├── layout/ (7)
│   ├── app-sidebar.tsx
│   ├── sidebar-nav.tsx
│   ├── header.tsx
│   ├── user-nav.tsx           # Pode ser mesclado com auth/user-menu
│   ├── bottom-nav.tsx
│   ├── theme-toggle.tsx
│   └── page-container.tsx
├── ai-chat/ (6)
│   ├── ai-chat-provider.tsx
│   ├── ai-chat-panel.tsx
│   ├── ai-chat-sheet.tsx
│   ├── ai-chat-trigger.tsx
│   ├── ai-chat-messages.tsx
│   └── ai-chat-input.tsx
└── auth/ (2)                   # Simplificado - apenas social login
    ├── auth-modal.tsx          # ✅ Implementado (design login-03)
    └── user-menu.tsx           # 🔲 Substitui UserButton do Clerk
```

**Removidos (não necessários para social-only):**
- ~~login-form.tsx~~ (sem email/password)
- ~~signup-form.tsx~~ (sem email/password)
- ~~social-buttons.tsx~~ (integrado no auth-modal)

### Hooks (2)
```
hooks/
├── useAiChat.ts
└── useAiHint.ts (opcional, pode ficar no trigger)
```

### Pages (2)
```
app/
├── (app)/
│   ├── layout.tsx
│   └── app/
│       └── page.tsx
```

### Mocks (1)
```
lib/mock-ai-chat.ts
```

### Atualizações (2)
```
app/layout.tsx          # Theme provider
components/common/navbar.tsx  # Auth modal triggers
```

---

## Ordem de Execução (Atualizada)

```
⚠️  Fase 0.5: Route Protection (CRÍTICO - FAZER PRIMEIRO!)
    ├── middleware.ts
    └── (app)/layout.tsx protection
    ↓
Fase 0: Setup (deps, folders, mocks) ✅ Parcial
    ↓
Fase 6: Auth UI ✅ (modal, user-menu, OAuth popup)
    ↓
Fase 3: Layout Desktop (sidebar premium, header, page-container)
    ↓
Fase 4: Layout Mobile (bottom-nav)
    ↓
Fase 7: Layout Principal (app layout com sidebar + providers)
    ↓
Fase 1: Theme System (provider, toggle)
    ↓
Fase 2: AI Chat Context (provider, hook)
    ↓
Fase 5: AI Chat Components (trigger, panel, sheet, messages, input)
    ↓
Fase 8: Integração LP ✅ (navbar já atualizada)
    ↓
Fase 9: Refinamentos
```

**Próximos passos imediatos:**
1. ~~⚠️ **Fase 0.5** - Criar middleware.ts + proteger layout~~ ✅
2. ~~**Fase 3.2** - Implementar Sidebar Premium~~ ✅
3. ~~**Fase 7** - Integrar sidebar no layout~~ ✅
4. **Fase 4** - Bottom Nav mobile
5. **Fase 2/5** - AI Chat (context + components)

---

## Critérios de Sucesso

### Segurança (CRÍTICO)
- [x] ⚠️ `/app` protegido por middleware (redireciona não-autenticados)
- [x] ⚠️ Layout server-side verifica auth

### Auth (✅ Implementado)
- [x] Auth modal abre sobre LP (design login-03)
- [x] Social buttons only (Google/GitHub)
- [x] OAuth via popup (fallback redirect)
- [x] UserMenu próprio (substitui UserButton)
- [x] Navbar usa hooks (`useAuth`) não componentes Clerk
- [x] Testes auth passando (26 testes)

### Layout
- [x] `/app` renderiza corretamente (dashboard com cards)
- [x] Sidebar premium (collapsible, Cmd+B, cookie persistence)
- [x] Header com SidebarTrigger
- [ ] Bottom nav aparece só em mobile
- [ ] Layout responsivo sem quebras

### AI Chat
- [ ] AI Chat abre/fecha (panel desktop, sheet mobile)
- [ ] Animação de balões aparece uma vez
- [ ] Mensagens persistem em localStorage

### Theme
- [ ] Theme toggle funciona (light/dark/system)
- [ ] Preferência persiste

### Qualidade
- [ ] **ZERO** componentes visuais do Clerk
- [ ] Navegação por teclado funcional
- [ ] Build passa sem erros
- [ ] Todos os testes passando

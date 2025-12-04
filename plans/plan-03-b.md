# Plan 03-B - Dashboard com Magia + Métricas

> **Tipo:** Concept Board + Implementação
> **Baseado em:** Codebase atual, API WuzAPI, UX continuidade LP → App
> **Foco:** Transição suave, widgets funcionais, métricas reais

---

## Problema Atual

```
LP (Magia, animações, flow) → [FLASH BRUSCO] → Dashboard (genérico, sem vida)
```

O usuário perde a sensação de continuidade. Parece outro produto.

---

## Visão: Continuidade da Magia

```
LP conectado → Clica "Dashboard" → Transição animada (800ms) → Dashboard vivo
                                         │
                                         ├── Navbar morphs → Sidebar
                                         ├── Hero fades → Widgets entram staggered
                                         └── Mesma paleta, micro-animações
```

---

## 1. Transição de Login

### 1.1 Técnica: View Transitions + Fallback

```typescript
// Abordagem híbrida
const supportsViewTransitions = 'startViewTransition' in document;

async function navigateToDashboard() {
  if (supportsViewTransitions) {
    // Chrome 111+ - transição nativa suave
    document.startViewTransition(() => {
      router.push('/app');
    });
  } else {
    // Fallback: Framer Motion
    setIsTransitioning(true);
    await new Promise(r => setTimeout(r, 300)); // fade out
    router.push('/app');
  }
}
```

### 1.2 CSS View Transitions

```css
/* globals.css */
@view-transition {
  navigation: auto;
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.5s;
}

/* Elementos que morpham */
::view-transition-group(sidebar) {
  animation-duration: 0.6s;
}

::view-transition-group(user-nav) {
  animation-duration: 0.3s;
}
```

### 1.3 Shared Layout IDs (Framer Motion Fallback)

```tsx
// Navbar LP
<motion.div layoutId="logo">
  <Logo />
</motion.div>

<motion.div layoutId="user-nav">
  <UserMenu />
</motion.div>

// Sidebar Dashboard
<motion.div layoutId="logo">
  <Logo />
</motion.div>
```

### 1.4 Estados da Transição

```
ESTADO 1: LP (logado, TestPanel visível)
    │
    │ Clica "Acessar Dashboard"
    ▼
ESTADO 2: Transição (600-800ms)
    │
    │ ├── Logo: navbar → sidebar header (morph position)
    │ ├── UserNav: navbar-right → sidebar-footer ou header-right
    │ ├── Hero/TestPanel: fade out + scale down
    │ ├── Sidebar: slide in from left
    │ └── Widgets: fade in staggered (100ms delay each)
    ▼
ESTADO 3: Dashboard renderizado
```

---

## 2. Dashboard Layout

### 2.1 Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ┃ Logo LivChat    │  Dashboard                        [AI ✨] [Avatar] │
│ ┃─────────────────├─────────────────────────────────────────────────────│
│ ┃ ◉ Dashboard     │                                                     │
│ ┃   Instâncias    │  ┌─────────────────┐  ┌─────────────────────────┐  │
│ ┃   Webhooks      │  │ 📱 CONEXÃO      │  │ 📊 ATIVIDADE HOJE       │  │
│ ┃─────────────────│  │                 │  │                         │  │
│ ┃   Docs          │  │ +55 11 9xxxx    │  │     ┌──────────────┐    │  │
│ ┃   Settings      │  │ ● Online 2h     │  │  47 │▁▂▃▅▇█▅▃▂▁  │    │  │
│ ┃                 │  │                 │  │ msg │              │    │  │
│ ┃                 │  │ [Desconectar]   │  │     └──────────────┘    │  │
│ ┃                 │  └─────────────────┘  └─────────────────────────┘  │
│ ┃                 │                                                     │
│ ┃                 │  ┌───────────────────────────────────────────────┐  │
│ ┃                 │  │ ⚡ TESTE RÁPIDO                    [Expandir] │  │
│ ┃                 │  │                                               │  │
│ ┃                 │  │  +55 85 9xxxx-xxxx  │  Mensagem...  │ Enviar  │  │
│ ┃                 │  │                                               │  │
│ ┃                 │  │  Último: há 3min → ✓ Entregue                 │  │
│ ┃                 │  └───────────────────────────────────────────────┘  │
│ ┃                 │                                                     │
│ ┃                 │  ┌─────────────────┐  ┌─────────────────────────┐  │
│ ┃                 │  │ 📈 ESTE MÊS     │  │ 🔔 ATIVIDADE RECENTE    │  │
│ ┃                 │  │                 │  │                         │  │
│ ┃                 │  │ 1,247 msgs      │  │ • Msg → João (2min)     │  │
│ ┃                 │  │ ██████████░░    │  │ • Webhook (15min)       │  │
│ ┃                 │  │ 83% do limite   │  │ • Conectou (1h)         │  │
│ ┃                 │  │                 │  │                         │  │
│ ┃                 │  │ [Upgrade →]     │  │                         │  │
│ ┃                 │  └─────────────────┘  └─────────────────────────┘  │
│ ┃─────────────────│                                                     │
│ ┃ [?] [Settings]  │                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Continuidade Visual (LP → Dashboard)

| Elemento | LP | Dashboard |
|----------|-----|-----------|
| Background | `bg-black` gradient sutil | Mesmo gradient, mais sutil |
| Cards | Hover glow purple | Mesmo hover glow |
| Tipografia | Inter + JetBrains Mono | Idêntico |
| Cores | Purple primary (#8B5CF6) | Idêntico |
| Animações | Framer Motion stagger | Mesmas animações |
| Spacing | Consistente | Idêntico |

### 2.3 Micro-animações Dashboard

```typescript
// Números que animam ao carregar
const AnimatedNumber = ({ value }: { value: number }) => {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    spring.set(value);
  }, [value]);

  return <motion.span>{useTransform(spring, Math.round)}</motion.span>;
};

// Cards com entrada staggered
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};
```

---

## 3. Widgets do Dashboard

### 3.1 Widget: Conexão WhatsApp

**Dados disponíveis (API WuzAPI):**
- `GET /session/status` → `{ Connected, LoggedIn, jid }`
- JID contém o número: `5511999999999@s.whatsapp.net`

**Dados calculados (frontend):**
- Uptime: tempo desde `connectedAt` (armazenar em state/localStorage)

```typescript
interface ConnectionWidgetProps {
  status: {
    connected: boolean;
    loggedIn: boolean;
    jid?: string;
  };
  connectedSince?: Date; // persistir em localStorage
}

// Estados visuais
const statusConfig = {
  online: { color: 'green', label: 'Online', icon: CheckCircle },
  connecting: { color: 'yellow', label: 'Conectando...', icon: Loader },
  offline: { color: 'red', label: 'Desconectado', icon: XCircle },
};
```

**UI:**
```
┌─────────────────────────────────────┐
│ 📱 Conexão WhatsApp                 │
│                                     │
│ +55 11 94818-2061                   │
│ ● Online há 2h 34min                │
│                                     │
│ [Reconectar]  [Desconectar]         │
└─────────────────────────────────────┘
```

---

### 3.2 Widget: Teste Rápido (Reutilizar TestPanel)

**Já implementado em:** `components/marketing/test-panel.tsx`

**Adaptação para Dashboard:**

```typescript
// Criar variante compacta
interface TestPanelProps {
  variant: 'full' | 'compact';
  // full: como na LP (tabs, código, response grande)
  // compact: inline (número + msg + enviar)
}

// compact mode
┌───────────────────────────────────────────────────────────────┐
│ ⚡ Teste Rápido                                    [Expandir] │
│                                                               │
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────┐ │
│ │ +55 85 98864-4401   │ │ Sua mensagem...     │ │ Enviar ↵ │ │
│ └─────────────────────┘ └─────────────────────┘ └──────────┘ │
│                                                               │
│ Último envio: há 5 min → ✓ Entregue para João                │
└───────────────────────────────────────────────────────────────┘

// expanded mode (mesmo da LP)
```

**Funcionalidades:**
- Mesmo `demo.send` já implementado
- Validação de número com `demo.validate`
- Histórico de envios recentes (localStorage)
- Contatos frequentes (localStorage)

---

### 3.3 Widget: Métricas de Uso

**Problema:** WuzAPI não fornece métricas agregadas nativamente.

**Solução:** Criar sistema de tracking no nosso backend.

#### 3.3.1 Schema de Métricas (Drizzle)

```typescript
// server/db/schema.ts

export const usageEvents = pgTable('usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(), // Clerk user ID
  instanceId: text('instance_id').notNull(), // WuzAPI instance

  // Evento
  eventType: text('event_type').notNull(), // 'message_sent' | 'message_received' | 'webhook_triggered'
  direction: text('direction'), // 'inbound' | 'outbound'

  // Metadata
  messageId: text('message_id'),
  contactJid: text('contact_jid'),
  mediaType: text('media_type'), // 'text' | 'image' | 'audio' | 'video' | 'document'
  mediaSize: integer('media_size'), // bytes

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usageDaily = pgTable('usage_daily', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  instanceId: text('instance_id'),
  date: timestamp('date').notNull(), // Dia (sem hora)

  // Contadores
  messagesSent: integer('messages_sent').default(0),
  messagesReceived: integer('messages_received').default(0),
  mediaBytesSent: integer('media_bytes_sent').default(0),
  mediaBytesReceived: integer('media_bytes_received').default(0),
  webhooksTriggered: integer('webhooks_triggered').default(0),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Índice único por user+instance+date
  uniqueDaily: uniqueIndex('usage_daily_unique').on(table.userId, table.instanceId, table.date),
}));
```

#### 3.3.2 Webhook Handler (Receber eventos do WuzAPI)

```typescript
// app/api/webhooks/wuzapi/route.ts

import { db } from '~/server/db';
import { usageEvents, usageDaily } from '~/server/db/schema';

export async function POST(req: Request) {
  const body = await req.json();
  const { event, type, token } = body;

  // Identificar instância pelo token
  const instance = await getInstanceByToken(token);
  if (!instance) return new Response('Unauthorized', { status: 401 });

  // Registrar evento
  if (type === 'Message') {
    const direction = event.Info.FromMe ? 'outbound' : 'inbound';
    const mediaType = getMediaType(event.Message);
    const mediaSize = event.s3?.size || 0;

    // Inserir evento detalhado
    await db.insert(usageEvents).values({
      userId: instance.userId,
      instanceId: instance.id,
      eventType: direction === 'outbound' ? 'message_sent' : 'message_received',
      direction,
      messageId: event.Info.Id,
      contactJid: event.Info.RemoteJid,
      mediaType,
      mediaSize,
    });

    // Incrementar contador diário (upsert)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await db
      .insert(usageDaily)
      .values({
        userId: instance.userId,
        instanceId: instance.id,
        date: today,
        messagesSent: direction === 'outbound' ? 1 : 0,
        messagesReceived: direction === 'inbound' ? 1 : 0,
        mediaBytesSent: direction === 'outbound' ? mediaSize : 0,
        mediaBytesReceived: direction === 'inbound' ? mediaSize : 0,
      })
      .onConflictDoUpdate({
        target: [usageDaily.userId, usageDaily.instanceId, usageDaily.date],
        set: {
          messagesSent: sql`${usageDaily.messagesSent} + ${direction === 'outbound' ? 1 : 0}`,
          messagesReceived: sql`${usageDaily.messagesReceived} + ${direction === 'inbound' ? 1 : 0}`,
          mediaBytesSent: sql`${usageDaily.mediaBytesSent} + ${direction === 'outbound' ? mediaSize : 0}`,
          mediaBytesReceived: sql`${usageDaily.mediaBytesReceived} + ${direction === 'inbound' ? mediaSize : 0}`,
          updatedAt: new Date(),
        },
      });
  }

  return new Response('OK', { status: 200 });
}
```

#### 3.3.3 tRPC Router para Métricas

```typescript
// server/api/routers/metrics.ts

export const metricsRouter = createTRPCRouter({
  // Métricas de hoje
  today: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await ctx.db
      .select({
        sent: sql<number>`COALESCE(SUM(${usageDaily.messagesSent}), 0)`,
        received: sql<number>`COALESCE(SUM(${usageDaily.messagesReceived}), 0)`,
        bytesSent: sql<number>`COALESCE(SUM(${usageDaily.mediaBytesSent}), 0)`,
        bytesReceived: sql<number>`COALESCE(SUM(${usageDaily.mediaBytesReceived}), 0)`,
      })
      .from(usageDaily)
      .where(
        and(
          eq(usageDaily.userId, ctx.auth.userId),
          gte(usageDaily.date, today)
        )
      );

    return {
      messagesSent: result[0]?.sent ?? 0,
      messagesReceived: result[0]?.received ?? 0,
      totalMessages: (result[0]?.sent ?? 0) + (result[0]?.received ?? 0),
      dataSent: result[0]?.bytesSent ?? 0,
      dataReceived: result[0]?.bytesReceived ?? 0,
    };
  }),

  // Métricas dos últimos 7 dias (para sparkline)
  week: protectedProcedure.query(async ({ ctx }) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const results = await ctx.db
      .select({
        date: usageDaily.date,
        sent: usageDaily.messagesSent,
        received: usageDaily.messagesReceived,
      })
      .from(usageDaily)
      .where(
        and(
          eq(usageDaily.userId, ctx.auth.userId),
          gte(usageDaily.date, weekAgo)
        )
      )
      .orderBy(usageDaily.date);

    // Preencher dias sem dados com 0
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayData = results.find(r =>
        r.date.toDateString() === date.toDateString()
      );

      days.push({
        date: date.toISOString(),
        sent: dayData?.sent ?? 0,
        received: dayData?.received ?? 0,
        total: (dayData?.sent ?? 0) + (dayData?.received ?? 0),
      });
    }

    return days;
  }),

  // Métricas do mês (para quota)
  month: protectedProcedure.query(async ({ ctx }) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const result = await ctx.db
      .select({
        sent: sql<number>`COALESCE(SUM(${usageDaily.messagesSent}), 0)`,
        received: sql<number>`COALESCE(SUM(${usageDaily.messagesReceived}), 0)`,
      })
      .from(usageDaily)
      .where(
        and(
          eq(usageDaily.userId, ctx.auth.userId),
          gte(usageDaily.date, monthStart)
        )
      );

    const total = (result[0]?.sent ?? 0) + (result[0]?.received ?? 0);
    const limit = getUserMessageLimit(ctx.auth.userId); // baseado no plano

    return {
      used: total,
      limit,
      percentage: Math.round((total / limit) * 100),
    };
  }),
});
```

#### 3.3.4 UI do Widget de Métricas

```typescript
// components/dashboard/metrics-widget.tsx

export function MetricsWidget() {
  const today = api.metrics.today.useQuery();
  const week = api.metrics.week.useQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Atividade Hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <AnimatedNumber value={today.data?.totalMessages ?? 0} />
            <span className="text-muted-foreground ml-1">mensagens</span>
          </div>

          {/* Sparkline dos últimos 7 dias */}
          <Sparkline data={week.data?.map(d => d.total) ?? []} />
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          <span className="text-green-500">↑ {today.data?.messagesSent}</span>
          {' enviadas • '}
          <span className="text-blue-500">↓ {today.data?.messagesReceived}</span>
          {' recebidas'}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 3.4 Widget: Uso do Mês / Quota

```typescript
// components/dashboard/quota-widget.tsx

export function QuotaWidget() {
  const month = api.metrics.month.useQuery();
  const plan = api.user.plan.useQuery();

  const isNearLimit = (month.data?.percentage ?? 0) > 80;
  const isAtLimit = (month.data?.percentage ?? 0) >= 100;

  return (
    <Card className={isNearLimit ? 'border-yellow-500/50' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Este Mês
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>{formatNumber(month.data?.used ?? 0)} mensagens</span>
            <span className="text-muted-foreground">
              de {formatNumber(month.data?.limit ?? 0)}
            </span>
          </div>

          <Progress
            value={month.data?.percentage ?? 0}
            className={isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : ''}
          />

          <div className="flex justify-between items-center">
            <Badge variant={plan.data?.name === 'free' ? 'secondary' : 'default'}>
              {plan.data?.name ?? 'Free'}
            </Badge>

            {isNearLimit && !isAtLimit && (
              <Button size="sm" variant="outline">
                Fazer Upgrade
              </Button>
            )}

            {isAtLimit && (
              <span className="text-sm text-red-500">Limite atingido</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 3.5 Widget: Atividade Recente

```typescript
// server/api/routers/activity.ts

export const activityRouter = createTRPCRouter({
  recent: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const events = await ctx.db
        .select()
        .from(usageEvents)
        .where(eq(usageEvents.userId, ctx.auth.userId))
        .orderBy(desc(usageEvents.createdAt))
        .limit(input.limit);

      return events.map(e => ({
        id: e.id,
        type: e.eventType,
        direction: e.direction,
        contact: formatJid(e.contactJid),
        mediaType: e.mediaType,
        timestamp: e.createdAt,
        relativeTime: formatRelativeTime(e.createdAt),
      }));
    }),
});
```

```typescript
// components/dashboard/activity-widget.tsx

export function ActivityWidget() {
  const activity = api.activity.recent.useQuery({ limit: 5 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activity.data?.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 text-sm"
            >
              <ActivityIcon type={event.type} />
              <div className="flex-1 min-w-0">
                <span className="truncate">
                  {event.direction === 'outbound' ? 'Enviou para' : 'Recebeu de'}{' '}
                  <span className="font-medium">{event.contact}</span>
                </span>
              </div>
              <span className="text-muted-foreground text-xs">
                {event.relativeTime}
              </span>
            </motion.div>
          ))}

          {activity.data?.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              Nenhuma atividade ainda
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 4. Implementação TDD

### Fase 1: Transição de Login

**Arquivos:**
- [ ] `lib/view-transitions.ts` - Helpers para View Transitions API
- [ ] `components/layout/transition-provider.tsx` - Provider para estado de transição
- [ ] `hooks/usePageTransition.ts` - Hook para iniciar transições

**Testes:**
```typescript
// tests/unit/hooks/usePageTransition.test.ts
describe('usePageTransition', () => {
  it('uses View Transitions API when supported')
  it('falls back to Framer Motion when not supported')
  it('sets transitioning state during animation')
  it('completes transition after duration')
})
```

**Critérios de Aceite:**
- [ ] Transição suave de LP → Dashboard (sem flash)
- [ ] Logo e UserNav morpham de posição
- [ ] Widgets entram com animação staggered
- [ ] Funciona em Chrome (View Transitions) e Firefox (fallback)

---

### Fase 2: Schema de Métricas

**Arquivos:**
- [ ] `server/db/schema.ts` - Adicionar `usageEvents` e `usageDaily`
- [ ] `drizzle/migrations/` - Migration para novas tabelas

**Testes:**
```typescript
// tests/int/db/usage.test.ts
describe('Usage Schema', () => {
  it('creates usage event')
  it('increments daily counter on conflict')
  it('aggregates by user and date')
})
```

**Critérios de Aceite:**
- [ ] Tabelas criadas no Neon
- [ ] Upsert funciona para contadores diários
- [ ] Índices otimizados para queries de métricas

---

### Fase 3: Webhook Handler

**Arquivos:**
- [ ] `app/api/webhooks/wuzapi/route.ts` - Handler de webhooks WuzAPI
- [ ] `server/services/metrics.ts` - Service para registrar métricas

**Testes:**
```typescript
// tests/int/api/webhooks/wuzapi.test.ts
describe('WuzAPI Webhook Handler', () => {
  it('registers outbound message event')
  it('registers inbound message event')
  it('increments daily counter')
  it('handles media size tracking')
  it('rejects invalid tokens')
})
```

**Critérios de Aceite:**
- [ ] Recebe webhooks do WuzAPI (configurar no .env)
- [ ] Registra eventos de mensagem (sent/received)
- [ ] Incrementa contadores diários
- [ ] Ignora eventos de outros tipos (ReadReceipt por enquanto)

---

### Fase 4: tRPC Metrics Router

**Arquivos:**
- [ ] `server/api/routers/metrics.ts` - Router de métricas
- [ ] `server/api/routers/activity.ts` - Router de atividade

**Testes:**
```typescript
// tests/unit/routers/metrics.test.ts
describe('Metrics Router', () => {
  it('returns today metrics for user')
  it('returns week data with zeros for missing days')
  it('returns month usage with percentage')
  it('respects user plan limits')
})
```

**Critérios de Aceite:**
- [ ] `metrics.today` retorna totais do dia
- [ ] `metrics.week` retorna array de 7 dias (com zeros)
- [ ] `metrics.month` retorna uso vs limite
- [ ] `activity.recent` retorna últimos N eventos

---

### Fase 5: Widgets do Dashboard

**Arquivos:**
- [ ] `components/dashboard/connection-widget.tsx`
- [ ] `components/dashboard/test-panel-compact.tsx`
- [ ] `components/dashboard/metrics-widget.tsx`
- [ ] `components/dashboard/quota-widget.tsx`
- [ ] `components/dashboard/activity-widget.tsx`
- [ ] `components/dashboard/sparkline.tsx`
- [ ] `components/dashboard/animated-number.tsx`

**Testes:**
```typescript
// tests/unit/components/dashboard/metrics-widget.test.tsx
describe('MetricsWidget', () => {
  it('renders loading state')
  it('renders metrics with animated numbers')
  it('renders sparkline chart')
  it('shows sent/received breakdown')
})
```

**Critérios de Aceite:**
- [ ] Widgets renderizam com dados mockados
- [ ] Números animam ao carregar (count up)
- [ ] Sparkline funciona com dados variados
- [ ] Estados de loading e empty funcionam

---

### Fase 6: Dashboard Page

**Arquivos:**
- [ ] `app/(app)/app/page.tsx` - Refatorar com widgets reais

**Testes:**
```typescript
// tests/unit/app/dashboard-page.test.tsx
describe('Dashboard Page', () => {
  it('renders all widgets')
  it('shows welcome message for new users')
  it('widgets enter with staggered animation')
  it('is responsive (mobile stacks, desktop grid)')
})
```

**Critérios de Aceite:**
- [ ] Grid de 2 colunas desktop, 1 coluna mobile
- [ ] Todos os 5 widgets renderizam
- [ ] Animações de entrada funcionam
- [ ] Estilos consistentes com LP

---

### Fase 7: TestPanel Compacto

**Arquivos:**
- [ ] Refatorar `components/marketing/test-panel.tsx` para aceitar `variant`
- [ ] Ou criar `components/dashboard/quick-test.tsx` separado

**Testes:**
```typescript
// tests/unit/components/dashboard/quick-test.test.tsx
describe('QuickTest Widget', () => {
  it('renders inline form')
  it('validates phone number')
  it('sends message via demo.send')
  it('shows last send result')
  it('expands to full mode on click')
})
```

**Critérios de Aceite:**
- [ ] Modo compacto funciona (1 linha)
- [ ] Expande para modo completo
- [ ] Histórico de envios recentes
- [ ] Reutiliza lógica existente do demo router

---

## 5. Dependências e Ordem

```
Fase 1: Transição ─────────────────────────────────────┐
                                                       │
Fase 2: Schema ──┬──> Fase 3: Webhook ──> Fase 4: tRPC │
                 │                                     │
                 └────────────────────────────────────>├──> Fase 6: Dashboard Page
                                                       │
Fase 5: Widgets ───────────────────────────────────────┤
                                                       │
Fase 7: TestPanel ─────────────────────────────────────┘
```

**Paralelo:**
- Fase 1 (Transição) pode rodar paralelo com Fases 2-4 (Backend)
- Fase 5 (Widgets) pode usar dados mockados enquanto backend não está pronto
- Fase 7 (TestPanel) depende de ter o dashboard montado

---

## 6. Mockup de Dados (Para Desenvolvimento)

```typescript
// lib/mock-dashboard.ts

export const mockMetrics = {
  today: {
    messagesSent: 47,
    messagesReceived: 123,
    totalMessages: 170,
    dataSent: 1024 * 1024 * 2.5, // 2.5 MB
    dataReceived: 1024 * 1024 * 15, // 15 MB
  },
  week: [
    { date: '2024-01-08', total: 120 },
    { date: '2024-01-09', total: 85 },
    { date: '2024-01-10', total: 200 },
    { date: '2024-01-11', total: 150 },
    { date: '2024-01-12', total: 90 },
    { date: '2024-01-13', total: 45 },
    { date: '2024-01-14', total: 170 },
  ],
  month: {
    used: 1247,
    limit: 1500,
    percentage: 83,
  },
};

export const mockActivity = [
  { id: '1', type: 'message_sent', contact: 'João', relativeTime: 'há 2 min' },
  { id: '2', type: 'message_received', contact: 'Maria', relativeTime: 'há 5 min' },
  { id: '3', type: 'webhook_triggered', contact: '-', relativeTime: 'há 15 min' },
  { id: '4', type: 'message_sent', contact: 'Pedro', relativeTime: 'há 1h' },
  { id: '5', type: 'connected', contact: '-', relativeTime: 'há 2h' },
];

export const mockConnection = {
  connected: true,
  loggedIn: true,
  jid: '5511948182061@s.whatsapp.net',
  connectedSince: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h atrás
};
```

---

## 7. Referências de API WuzAPI Utilizadas

| Endpoint | Uso no Dashboard |
|----------|------------------|
| `GET /session/status` | Widget Conexão (connected, loggedIn, jid) |
| `POST /chat/send/text` | Teste Rápido (já implementado via demo.send) |
| `POST /user/check` | Validação de número (já implementado via demo.validate) |
| Webhook `Message` | Incrementar métricas (messagesSent/Received) |
| Webhook `ReadReceipt` | Futuro: status de entrega |

---

## 8. Considerações Finais

### O que este plano NÃO inclui (futuro):
- Multi-instância (apenas 1 instância demo por enquanto)
- Gráficos elaborados (apenas sparkline simples)
- Filtros de período customizados
- Export de dados
- Webhooks configuráveis pelo usuário

### MVP Mínimo para "Magia":
1. ✅ Transição suave LP → Dashboard
2. ✅ Widget Conexão (status real)
3. ✅ Widget Teste Rápido (reusar código existente)
4. ⏳ Widget Métricas (precisa backend, pode mockar)
5. ⏳ Widget Atividade (precisa backend, pode mockar)

### Sugestão de Implementação Incremental:

**Sprint 1 (Magia Imediata):**
- Transição de login
- Widgets com dados mockados
- Visual consistente com LP

**Sprint 2 (Dados Reais):**
- Schema de métricas
- Webhook handler
- Conectar widgets a dados reais

**Sprint 3 (Refinamento):**
- TestPanel compacto
- Histórico de envios
- Animações polidas

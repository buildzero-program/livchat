# Plan 01 - Landing Page Mockada

> **Baseado em:** `docs/system-design.md`
> **Referência de código:** `refs/front-google/`

## Objetivo
Migrar o frontend de `refs/front-google/` para o projeto T3 em `app/`, mantendo tudo **mockado** (sem backend real). Foco em ter a LP funcional e visualmente idêntica.

---

## Metodologia: TDD para Unit Tests

```
1. ESCREVER TESTE   ← criar .test.ts
2. ESCREVER CÓDIGO  ← implementar
3. EXECUTAR TESTE   ← bun test
4. REFATORAR        ← melhorar
```

**Otimização:** Pulamos a primeira execução (sabemos que falha sem código).

**Estrutura de testes:**
```
tests/
├── unit/           # Funções puras, helpers
├── int/            # Endpoints, tRPC
└── e2e/            # Fluxos completos (futuro)
```

---

## Status do Setup (Concluído)

- [x] Bun 1.3.3 instalado
- [x] Projeto T3 criado (Next.js 15 + tRPC + Drizzle + Tailwind 4)
- [x] shadcn/ui inicializado com componentes base
- [x] Dependências extras: Clerk, Framer Motion, Lucide React
- [x] Estrutura de pastas criada (groups: marketing, auth, dashboard)
- [x] Layout root com ClerkProvider e metadata LivChat
- [x] Tema dark com cores purple (#8B5CF6)

---

## Análise do Front-Google

### Componentes a Migrar

| Componente | Arquivo Original | Destino T3 | Complexidade |
|------------|------------------|------------|--------------|
| Button | `components/Button.tsx` | Usar shadcn `button.tsx` | Baixa |
| Hero | `components/Hero.tsx` | `components/marketing/hero.tsx` | Alta |
| Features | `components/Features.tsx` | `components/marketing/features.tsx` | Média |
| Integration | `components/Integration.tsx` | `components/marketing/integration.tsx` | Média |
| Pricing | `components/Pricing.tsx` | `components/marketing/pricing.tsx` | Média |
| TestPanel | `components/TestPanel.tsx` | `components/marketing/test-panel.tsx` | Alta |
| Navbar | Em `App.tsx` | `components/common/navbar.tsx` | Média |
| Footer | Em `App.tsx` | `components/common/footer.tsx` | Baixa |

### Design System a Preservar

```
Cores:
- Primary: #8B5CF6 (purple)
- Primary Hover: #7C3AED
- Background: #0A0A0A
- Surface: #111111, #141414, #161616
- Border: #1F1F1F, #262626
- Text: #FFFFFF, #A1A1AA, #71717A

Fonts:
- Sans: Inter (400-800)
- Mono: JetBrains Mono (400-500)

Animações Framer Motion:
- Fade in: opacity 0→1, y 20→0
- Hover: scale 1.02, y -5
- Scan line: top 0%→100%→0%, 1.5s infinite
- Bounce: delay staggered 0-300ms
```

---

## Tarefas

### Fase 1: Estrutura Base ✅
- [x] 1.1 Atualizar `globals.css` com design system completo
- [x] 1.2 Configurar fonts (Inter + JetBrains Mono) no layout
- [x] 1.3 Criar `lib/constants.ts` com dados mockados
- [x] 1.4 Criar `lib/mock-data.ts` com features, pricing, testimonials
- [x] 1.5 Testes unit: `tests/unit/constants.test.ts` (26 testes passando)
- [x] 1.6 Testes unit: `tests/unit/mock-data.test.ts`

### Fase 2: Componentes Comuns ✅
- [x] 2.1 Criar `components/common/navbar.tsx`
- [x] 2.2 Criar `components/common/footer.tsx`
- [x] 2.3 Criar `app/(marketing)/layout.tsx` com Navbar + Footer
- [x] 2.4 Criar `app/(marketing)/page.tsx` placeholder

### Fase 3: Seções da Landing Page ✅
- [x] 3.1 Criar `components/marketing/hero.tsx` (sem QR/TestPanel)
- [x] 3.2 Criar `components/marketing/qr-card.tsx` (QR interativo mockado)
- [x] 3.3 Criar `components/marketing/test-panel.tsx` (respostas mockadas)
- [x] 3.4 Criar `components/marketing/social-proof.tsx` (marquee)
- [x] 3.5 Criar `components/marketing/metrics.tsx` (números)
- [x] 3.6 Criar `components/marketing/features.tsx` (grid 8 cards)
- [x] 3.7 Criar `components/marketing/integration.tsx` (code tabs)
- [x] 3.8 Criar `components/marketing/pricing.tsx` (slider + 3 plans)
- [x] 3.9 Criar `components/marketing/testimonials.tsx`
- [x] 3.10 Criar `components/marketing/cta-final.tsx`

### Fase 4: Página Principal ✅
- [x] 4.1 Criar `app/(marketing)/page.tsx` montando todas as seções
- [x] 4.2 Criar `app/(marketing)/layout.tsx` com Navbar + Footer
- [x] 4.3 Testar responsividade (mobile, tablet, desktop)
- [x] 4.4 Testar animações e interações

### Fase 5: REFACTOR
- [ ] 5.1 Revisar código duplicado e extrair utilitários
- [ ] 5.2 Padronizar nomes e exports
- [ ] 5.3 Otimizar imports e bundle size
- [ ] 5.4 Garantir `bun build` sem warnings

### Fase 6: RED → Escrever Testes
- [ ] 6.1 Criar `lib/mock-data.test.ts` (testar funções de mock)
- [ ] 6.2 Criar `lib/utils.test.ts` (formatPhone, calculatePrice, etc)
- [ ] 6.3 Criar `components/marketing/pricing.test.tsx` (slider logic)
- [ ] 6.4 Criar `components/marketing/test-panel.test.tsx` (mock response)
- [ ] 6.5 Rodar `bun test` e garantir todos passam

### Fase 7: Páginas Secundárias (opcional)
- [ ] 7.1 Criar `app/(marketing)/pricing/page.tsx`
- [ ] 7.2 Criar `app/(marketing)/docs/page.tsx` (placeholder)

---

## Decisões Técnicas

### shadcn/ui vs Componentes Custom

| Usar shadcn | Manter Custom |
|-------------|---------------|
| Button (adaptar variantes) | QR Card (muito específico) |
| Input, Textarea | Test Panel (layout único) |
| Tabs | Hero mockups (arte custom) |
| Card | Marquee animation |
| Badge | Pricing slider |
| Separator | |

### Estrutura de Estado (Mockado)

```typescript
// Hero component
const [connectionState, setConnectionState] = useState<
  'idle' | 'scanning' | 'connected'
>('idle');

// Test Panel
const [activeTab, setActiveTab] = useState<'message' | 'media' | 'groups' | 'webhook'>('message');
const [isLoading, setIsLoading] = useState(false);
const [response, setResponse] = useState<MockResponse | null>(null);

// Pricing
const [instances, setInstances] = useState(5);
```

### Dados Mockados

```typescript
// lib/mock-data.ts
export const MOCK_FEATURES = [...];
export const MOCK_PLANS = [...];
export const MOCK_TESTIMONIALS = [...];
export const MOCK_COMPANIES = [...];
export const MOCK_CODE_EXAMPLES = { node: '...', python: '...', php: '...' };

export const mockSendMessage = async () => {
  await new Promise(r => setTimeout(r, 800));
  return {
    success: true,
    messageId: `msg_${crypto.randomUUID().slice(0, 8)}`,
    status: 'sent',
    timestamp: new Date().toISOString(),
  };
};
```

---

## Critérios de Conclusão

### Funcional
- [ ] LP renderiza igual ao `refs/front-google/`
- [ ] Todas animações funcionando
- [ ] QR card simula scan → mostra TestPanel
- [ ] TestPanel envia mock e mostra resposta JSON
- [ ] Pricing slider atualiza total
- [ ] Code tabs alternam entre linguagens
- [ ] Mobile responsivo

### Build & Testes
- [ ] `bun dev` sem erros
- [ ] `bun build` sem erros/warnings
- [ ] `bun test` todos passando
- [ ] Cobertura mínima em funções utilitárias

---

## Próximo Plano (plan-02)

Após conclusão do plan-01:
- Integrar APIs reais (WuzAPI)
- Implementar sessão anônima real
- Conectar QR code ao backend
- Enviar mensagens de verdade

---

## Notas

- Manter código limpo, sem over-engineering
- Não criar abstrações desnecessárias
- Usar `'use client'` apenas onde necessário
- Preferir Server Components quando possível

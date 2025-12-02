# LivChat.ai - Landing Page Prompt

I am writing a prompt to use in Replit Design Mode: an AI agent specialized in designing beautiful landing pages. In addition to React/Shadcn/Tailwind code generation, this agent can also generate images, short videos and get stock photos from the internet.

I need to give enough context to it so that it generates a design that matches my expectations.

## Brand Context

**Product:** LivChat.ai - WhatsApp API for developers & martech
**Tagline:** "Envie fácil. Escale rápido."
**Target Audience:**
- **Developers**: Backend devs, full-stack, indie hackers
- **Martech/Marketing Tech**: Agências digitais, growth hackers, automação de campanhas
- **AI Agent builders**: LangChain, CrewAI, AutoGPT integrations
- **No-code enthusiasts**: n8n, Make, Zapier power users

**Tone of Voice:** Casual, dev-friendly, peer-like (inspired by AbacatePay). Direct, no corporate jargon. Use phrases like "Vai, integra aí" instead of formal CTAs.

**Key Differentiators:**
- **Zero friction onboarding** - Connect WhatsApp before creating account (like Lovable)
- Integration in minutes, not weeks
- Transparent per-message pricing (no hidden fees)
- Built for devs & marketers, by devs
- Works with AI Agents, n8n, Zapier, Make, HubSpot, RD Station

---

## Landing Page Sections

### Section 0: Menu Superior (Navigation)

Layout: Fixed top, full width
Background: White with subtle shadow on scroll

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  LivChat.ai     Docs   Pricing   Blog          [Acessar conta]  │
│                                                                  │
│  (quando logado, troca para:)                                   │
│                                                                  │
│  LivChat.ai     Docs   Pricing   Blog     [Avatar ▼] [Dashboard]│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**"Acessar conta" abre modal do Clerk:**
- Login e cadastro UNIFICADOS (Clerk gerencia)
- Providers: Google + GitHub
- Ao continuar, aceita Termos e Privacidade
- Se tinha sessão anônima, migra automaticamente após login

**Dropdown do Avatar (quando logado):**
- Nome + email
- Dashboard
- Configurações
- Sair

---

### Section 1: Hero with Dynamic Component (MAIN FEATURE)

**CRITICAL: O componente da direita muda conforme o estado do usuário. Tudo acontece inline na LP, sem redirecionar para outra página.**

**4 Estados Possíveis:**
- **Estado A**: Visitante (não logado, não conectado) → Mostra QR Code
- **Estado B**: Anônimo Conectado (não logado, WhatsApp conectado) → Mostra Painel de Teste
- **Estado C**: Logado sem WhatsApp → Mostra QR Code
- **Estado D**: Logado + Conectado → Mostra Painel de Teste completo

Layout: 2 columns (50/50 split)
Background color: #FFFFFF

**Column 1 (50%):**
- Badge/Pill: "Usado por +500 devs e agências" (social proof)
- Title h1: "Conecte seu WhatsApp em 30 segundos. Sem cadastro."
- Subtitle: "Escaneie o QR code e comece a testar agora. Crie sua conta depois, só quando quiser. Zero atrito, do jeito que dev gosta."
- Small features list:
  - ✓ "Teste antes de criar conta"
  - ✓ "50 mensagens grátis por dia"
  - ✓ "Sem cartão de crédito"
  - ✓ "Desconecte quando quiser"

**Column 2 (50%) - Componente Dinâmico:**

O componente muda conforme o estado do usuário. Todos os estados acontecem INLINE na LP.

---

#### ESTADO A/C: QR Code (Visitante ou Logado sem WhatsApp)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│            ┌──────────────────┐                                 │
│            │                  │                                 │
│            │    [QR CODE]     │                                 │
│            │     (live)       │                                 │
│            │                  │                                 │
│            └──────────────────┘                                 │
│                                                                  │
│   1. Abra o WhatsApp no celular                                 │
│   2. Toque em "Aparelhos conectados"                            │
│   3. Escaneie este código                                       │
│                                                                  │
│   ○ ○ ○  Aguardando conexão...                                  │
│                                                                  │
│   ─────────────────────────────────────────────────────         │
│   🔒 Conexão segura e criptografada                             │
│   📱 Você pode desconectar a qualquer momento                   │
│                                                                  │
│   Ao escanear, você concorda com nossos                         │
│   [Termos de Uso] e [Política de Privacidade]                   │
│                                                                  │
│   ─────────────────── ou ───────────────────                    │
│                                                                  │
│   [📱 Usar código de pareamento]                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

```

---

#### ESTADO A/C (alternativo): Pairing Code

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Digite seu número para gerar o código:                        │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ 🇧🇷 +55 │ (11) 99999-9999                              │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│                    [Gerar código →]                              │
│                                                                  │
│   ─────────────────────────────────────────────────────         │
│                                                                  │
│   Seu código de pareamento:                                     │
│                                                                  │
│   ┌───────────────────────────────┐                             │
│   │       4X7-2K9-ABC             │  [Copiar]                   │
│   └───────────────────────────────┘                             │
│                                                                  │
│   1. Abra WhatsApp > Configurações                              │
│   2. Aparelhos conectados > Conectar                            │
│   3. "Conectar com número" > Digite o código                    │
│                                                                  │
│   ⏱️ Código expira em 4:32                                       │
│                                                                  │
│   ─────────────────────────────────────────────────────         │
│   Ao usar, você concorda com nossos                             │
│   [Termos de Uso] e [Política de Privacidade]                   │
│                                                                  │
│   [← Voltar para QR Code]                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

#### ESTADO B/D: Painel de Teste (Anônimo Conectado ou Logado + Conectado)

**Este é o painel interativo estilo Jina.ai, inline na LP:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 📱 MENSAGEM   🖼️ MÍDIA   👥 GRUPOS   🔗 WEBHOOK   📖 DOCS  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────┬──────────────────────────────────┐│
│  │                          │                                  ││
│  │   PARÂMETROS             │   [cURL] [Node] [Python] [n8n]  ││
│  │                          │                                  ││
│  │   Para:                  │   ┌──────────────────────────┐  ││
│  │   ┌──────────────────┐   │   │ curl -X POST \           │  ││
│  │   │+55 11 99999-9999 │   │   │   https://api.livchat.ai/│  ││
│  │   └──────────────────┘   │   │   v1/message \           │  ││
│  │                          │   │   -H "Authorization:     │  ││
│  │   Mensagem:              │   │       Bearer lc_xxx" \   │  ││
│  │   ┌──────────────────┐   │   │   -d '{"to":"..."}'     │  ││
│  │   │                  │   │   └──────────────────────────┘  ││
│  │   │ Olá! Teste 🚀   │   │                      [Copiar 📋]││
│  │   │                  │   │                                  ││
│  │   └──────────────────┘   │           [▶ ENVIAR]            ││
│  │                          │   ────────────────────────────  ││
│  │   ☐ Link Preview         │   Response:                     ││
│  │                          │   🟢 200 OK (0.3s)              ││
│  │   Tipo: [Texto     ▼]    │   {                             ││
│  │                          │     "success": true,            ││
│  │                          │     "id": "msg_abc123"          ││
│  │                          │   }                             ││
│  │                          │                                  ││
│  └──────────────────────────┴──────────────────────────────────┘│
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  📱 +55 11 9xxxx-xxxx   │  🔑 lc_anon_xxx...  [👁] [📋]   │  │
│  │  🟢 Conectado            │  📊 Restam: 47/50 msgs hoje     │  │
│  │                          │                                 │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                            │  │
│  │  (Se não logado - Estado B):                              │  │
│  │  [🔓 Acessar conta para salvar sessão e desbloquear mais] │  │
│  │                                                            │  │
│  │  (Se logado free - Estado D):                             │  │
│  │  [⚡ Upgrade para mais instâncias e msgs ilimitadas]       │  │
│  │                                                            │  │
│  │  [🔌 Desconectar WhatsApp]                                │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Tabs do Painel de Teste:**

| Tab | Funcionalidade |
|-----|----------------|
| 📱 MENSAGEM | Enviar texto (default) |
| 🖼️ MÍDIA | Enviar imagem/vídeo/áudio/documento |
| 👥 GRUPOS | Listar grupos, enviar para grupo |
| 🔗 WEBHOOK | Configurar URL de webhook (só logado) |
| 📖 DOCS | Link para documentação completa |

---

**Technical Implementation Notes:**

**Estados e Transições:**
```
┌─────────────┐     escaneia QR      ┌─────────────┐
│  Estado A   │ ──────────────────► │  Estado B   │
│  Visitante  │                      │  Anônimo    │
│             │ ◄────────────────── │  Conectado  │
└─────────────┘     desconecta       └─────────────┘
       │                                    │
       │ clica "Acessar conta"              │ clica "Acessar conta"
       │ (Clerk modal)                      │ (Clerk modal + migração)
       ▼                                    ▼
┌─────────────┐     escaneia QR      ┌─────────────┐
│  Estado C   │ ──────────────────► │  Estado D   │
│  Logado sem │                      │  Logado +   │
│  WhatsApp   │ ◄────────────────── │  Conectado  │
└─────────────┘     desconecta       └─────────────┘
```

**Fluxo de Anonymous Session:**
- On page load: Check localStorage for `anonymous_id` and `anonymous_token`
- If none: Call `POST /api/public/session` to create anonymous session
- Store `anonymous_id` and `anonymous_token` in localStorage
- Call `POST /api/public/connect` to initiate WhatsApp connection
- Poll `GET /api/public/status` every 2 seconds for connection status
- When connected: Show Painel de Teste (Estado B)

**Migração de Sessão (Estado B → Estado D):**
```
1. Usuário clica "Acessar conta"
2. Clerk modal abre (Google/GitHub)
3. Usuário autentica
4. Frontend detecta: tem anonymous_token no localStorage?
5. Se sim: POST /api/session/migrate { anonymous_id }
6. Backend: vincula sessão WhatsApp ao user_id do Clerk
7. Backend: gera novo token (lc_user_xxx)
8. Frontend: limpa localStorage, usa novo token
9. Usuário agora está no Estado D
```

**Limites por Estado:**

| Estado | Instâncias | Msgs/dia | Webhook | Dashboard |
|--------|------------|----------|---------|-----------|
| B (Anônimo) | 1 | 50 | ❌ | ❌ |
| D (Logado Free) | 1 | 50 | ✅ básico | ✅ básico |
| D (Logado Pago) | 5+ | Ilimitado | ✅ retry | ✅ completo |

**Limites Free Tier (dupla proteção):**
- Por IP: máximo 1 sessão ativa por IP
- Por sessão WhatsApp: máximo 50 msgs/dia
- Rate limit: 1 msg/segundo
- Sessão permanece ativa até:
  - Usuário desconectar manualmente
  - Bater limite de mensagens do dia
  - Inatividade prolongada (30 dias)

**Aceite de Políticas:**
- Texto de aceite visível ANTES de escanear QR ou gerar pairing code
- Links para Termos de Uso e Política de Privacidade
- Ao escanear/conectar, usuário aceita implicitamente

**Mobile Detection:**
- Use `navigator.userAgent` to detect mobile
- QR Code sempre disponível (pode usar outro celular)
- Pairing code como opção secundária (requer digitar número)

---

### Section 2: Video Demo / VSL

Layout: 1 column, centered
Background color: #F9FAFB (light gray)

**Content:**
- Small badge: "Ver em ação"
- Title h2: "Do zero à primeira mensagem em 2 minutos"
- Subtitle: "Veja como é simples conectar e enviar mensagens"

**Video Component:**
- Embedded video player (16:9 aspect ratio)
- Thumbnail: Screenshot of the QR code flow + connected state
- Play button overlay
- Duration badge: "2:15"
- Video content should show:
  1. Landing on the page
  2. Scanning QR code
  3. Sending test message
  4. Showing webhook receiving the response
  5. Quick API code example

**Below video:**
- CTA: "Experimentar agora →" (scrolls to hero QR code)
- Secondary: "Ver documentação técnica"

---

### Section 3: Social Proof Bar

Layout: 1 row, full width
Background color: #F9FAFB (light gray)

Content:
- Text: "Empresas que já usam LivChat"
- Logo carousel: [placeholder for 6 company logos]
- Metrics: "2M+ mensagens/mês • 99.9% uptime • <500ms latência"

---

### Section 4: Why LivChat

Layout: 1 column container with 3-column grid inside
Background color: #FFFFFF

Title h2: "Por que devs e marketers escolhem LivChat?"
Subtitle: "Chega de SDKs complicados, integrações quebradas e pricing confuso"

**Card Grid (3 columns, 2 rows):**

**Row 1 - Para Desenvolvedores:**

Card 1:
- Icon: Zap (Lucide Icons)
- Title h3: "Integração em 5 minutos"
- Description: "Copy-paste o código, configure o webhook, pronto. Sem burocracia, sem calls de vendas."

Card 2:
- Icon: Code (Lucide Icons)
- Title h3: "SDKs em todas as linguagens"
- Description: "Node.js, Python, Go, PHP, Ruby... escolhe a sua. Ou usa direto via REST API."

Card 3:
- Icon: Bot (Lucide Icons)
- Title h3: "Feito para AI Agents"
- Description: "Integra com LangChain, n8n, Make, Zapier. Seu chatbot em produção hoje."

**Row 2 - Para Martech & Agências:**

Card 4:
- Icon: Megaphone (Lucide Icons)
- Title h3: "Campanhas em escala"
- Description: "Broadcasts, sequências, segmentação. Integra com HubSpot, RD Station, ActiveCampaign."

Card 5:
- Icon: BarChart3 (Lucide Icons)
- Title h3: "Analytics em tempo real"
- Description: "Taxa de entrega, leitura, resposta. Dashboards prontos ou via API para seu BI."

Card 6:
- Icon: Users (Lucide Icons)
- Title h3: "Multi-números, multi-atendentes"
- Description: "Gerencie 10, 50, 100 números. Cada cliente da agência com seu próprio WhatsApp."

**Row 3 - Para Todos:**

Card 7:
- Icon: DollarSign (Lucide Icons)
- Title h3: "Preço transparente"
- Description: "R$ 89/instância. Mensagens ilimitadas. Sem taxa de setup, sem surpresas."

Card 8:
- Icon: Shield (Lucide Icons)
- Title h3: "Webhooks confiáveis"
- Description: "Receba eventos em tempo real com retry automático e HMAC para segurança."

Card 9:
- Icon: Rocket (Lucide Icons)
- Title h3: "Zero friction"
- Description: "Teste antes de criar conta. Conecte seu WhatsApp em 30 segundos, não 30 dias."

---

### Section 5: Integration Methods

Layout: 2 columns
Background color: #FFFFFF

**Column 1:**
Title h2: "Integre do seu jeito"
Subtitle: "Code, vibe-code ou no-code. Você escolhe."

Tabs or toggle showing 3 options:
- **API/SDK**: Show code example
- **No-Code**: Show n8n/Zapier logos and workflow screenshot
- **AI Agent**: Show LangChain/MCP integration example

**Column 2:**
- Visual: Dynamic code/screenshot based on selected tab
- SDK language badges: Node.js, Python, Go, PHP, Ruby, Java, C#, Rust

---

### Section 6: Pricing

Layout: 1 column, centered
Background color: #F9FAFB

Title h2: "Pricing simples. Sem surpresas."
Subtitle: "Por instância, não por mensagem. Escale sem medo."

**Pricing Cards:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│   │        FREE          │  │       STARTER        │  │      SCALE       │  │
│   │                      │  │      POPULAR ⭐      │  │                  │  │
│   │    R$ 0/mês         │  │    R$ 445/mês       │  │   Sob consulta   │  │
│   │                      │  │                      │  │                  │  │
│   │  • 1 instância       │  │  • 5 instâncias      │  │  • 20+ instâncias│  │
│   │  • 50 msgs/dia       │  │  • Msgs ilimitadas*  │  │  • Msgs ilimitadas│  │
│   │  • Sem login         │  │  • R$ 89/inst. extra │  │  • SLA dedicado  │  │
│   │  • API key anônima   │  │  • Dashboard         │  │  • Suporte priority│ │
│   │  • Testes/dev only   │  │  • Webhooks + retry  │  │  • IP dedicado   │  │
│   │                      │  │  • Analytics         │  │  • Onboarding    │  │
│   │                      │  │  • Uso comercial     │  │                  │  │
│   │                      │  │                      │  │                  │  │
│   │  [Começar grátis]    │  │  [Assinar agora →]   │  │  [Falar com time]│  │
│   │                      │  │                      │  │                  │  │
│   └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

*Rate limit de 10 msgs/segundo por instância

**Destaque abaixo dos cards:**
- "Cada instância = 1 número de WhatsApp"
- "Pague por instância, não por mensagem"
- "Cancele quando quiser, sem multa"

**FAQ inline (accordion):**
- "O que é uma instância?" → "Uma instância é uma conexão ativa com um número de WhatsApp. Se você tem 3 números, precisa de 3 instâncias."
- "As mensagens são realmente ilimitadas?" → "Sim, dentro do rate limit de 10 msgs/segundo por instância. Isso dá ~26 milhões de msgs/mês por instância."
- "Posso adicionar mais instâncias depois?" → "Sim! Cada instância adicional custa R$ 89/mês. Adicione e remova quando quiser."
- "E se eu precisar de mais de 20 instâncias?" → "Entre em contato para um plano personalizado com desconto por volume."

CTA Button: "Começar com 5 instâncias →"
Small text: "7 dias de garantia. Não gostou? Devolvemos seu dinheiro."

---

### Section 7: Testimonials

Layout: Masonry or carousel
Background color: #FFFFFF

Title h2: "O que devs e marketers estão dizendo"

**8 testimonial cards with:**
- Twitter/X style format
- Avatar
- Name, role, company
- Quote
- Tag: "Dev" or "Marketing" or "Agência"

**Developer testimonials:**

1. Avatar + "João Silva, Backend Dev @StartupX"
   - "Nunca integrei WhatsApp tão rápido. 10 minutos e já estava em produção."
   - Tag: Dev

2. Avatar + "Maria Santos, CTO @SaaSBrasil"
   - "Finalmente uma API de WhatsApp que não precisa de PhD pra entender."
   - Tag: Dev

3. Avatar + "Pedro Costa, Indie Hacker"
   - "Saí do Twilio pro LivChat. Metade do preço, dobro da simplicidade."
   - Tag: Dev

4. Avatar + "Ana Oliveira, AI Engineer @AIStartup"
   - "Meu bot de IA já enviou 50k mensagens. Zero problemas. LangChain + LivChat = 🔥"
   - Tag: Dev

**Martech testimonials:**

5. Avatar + "Ricardo Mendes, Head of Growth @E-commerce"
   - "Recuperamos 23% dos carrinhos abandonados só com WhatsApp. ROI absurdo."
   - Tag: Marketing

6. Avatar + "Fernanda Lima, CMO @AgênciaDigital"
   - "Gerenciamos 47 números de clientes num único dashboard. Game changer pra agência."
   - Tag: Agência

7. Avatar + "Carlos Eduardo, Growth Hacker"
   - "Campanhas de WhatsApp com 89% de abertura. Email marketing nunca mais."
   - Tag: Marketing

8. Avatar + "Juliana Rocha, Customer Success @TechCompany"
   - "O suporte no Discord é absurdo. Respondem em minutos, não dias."
   - Tag: Both

---

### Section 8: Use Cases (Devs + Martech)

Layout: 1 column with horizontal scroll cards
Background color: #18181B (dark)
Text color: #FFFFFF

Title h2: "Use cases para cada tipo de negócio"
Subtitle: "De startups a agências, de devs solo a times de marketing"

**Cards (horizontal scroll):**

Card 1 - Dev Focus:
- Icon: Key
- Title: "OTP/2FA"
- Description: "Autenticação segura via WhatsApp. 98% de taxa de entrega vs SMS."
- Tag: "Para Devs"

Card 2 - Dev Focus:
- Icon: Bell
- Title: "Notificações transacionais"
- Description: "Alertas de pedido, pagamento, entrega. Webhooks em tempo real."
- Tag: "Para Devs"

Card 3 - Martech Focus:
- Icon: Megaphone
- Title: "Campanhas de marketing"
- Description: "Broadcasts segmentados, sequências automatizadas, A/B testing."
- Tag: "Para Marketing"

Card 4 - Martech Focus:
- Icon: RefreshCw
- Title: "Recuperação de carrinho"
- Description: "Automação de carrinho abandonado. Integra com Shopify, WooCommerce, VTEX."
- Tag: "Para E-commerce"

Card 5 - Both:
- Icon: MessageSquare
- Title: "Suporte ao cliente"
- Description: "Chatbots + atendimento humano. Roteamento inteligente por departamento."
- Tag: "Para Todos"

Card 6 - Dev Focus:
- Icon: Bot
- Title: "AI Chatbots"
- Description: "Integre ChatGPT, Claude, Gemini ao WhatsApp. SDKs para LangChain e CrewAI."
- Tag: "Para AI Builders"

Card 7 - Martech Focus:
- Icon: Users
- Title: "Atendimento para agências"
- Description: "Multi-tenant: cada cliente com seu número, suas métricas, seu dashboard."
- Tag: "Para Agências"

Card 8 - Martech Focus:
- Icon: TrendingUp
- Title: "Lead nurturing"
- Description: "Sequências de nutrição, lead scoring via WhatsApp. Integra com CRMs."
- Tag: "Para Growth"

---

### Section 9: Security & Compliance

Layout: 2 columns
Background: Subtle gradient or textured background

**Column 1:**
Title h2: "Segurança enterprise, simplicidade startup"

**Column 2:**
Checklist cards:
- ✓ "Criptografia de ponta a ponta"
- ✓ "LGPD compliant - dados no Brasil"
- ✓ "99.9% uptime SLA"
- ✓ "Webhooks com HMAC signature"
- ✓ "SOC 2 Type II (em andamento)"

---

### Section 10: Final CTA

Layout: 1 column, centered
Background color: #18181B (dark)
Text color: #FFFFFF

Title h2: "Bora construir junto?"
Description:
- ✓ 1000 mensagens grátis
- ✓ Setup em 5 minutos
- ✓ Sem cartão de crédito
- ✓ Cancele quando quiser

Primary CTA: "Criar conta grátis →"
Secondary text: "Vai, clica. Você sabe que quer."

---

### Section 11: Footer

Layout: Multi-column
Background color: #0A0A0A (very dark)

**Columns:**
- Logo + tagline
- Product: Features, Pricing, Docs, API Status
- Resources: Blog, Changelog, Discord, GitHub
- Company: About, Careers, Contact
- Legal: Privacy Policy, Terms of Service, LGPD

Social icons: Twitter/X, GitHub, Discord, LinkedIn

---

## Design Guidelines

**Note:** The design.json below should be updated after analyzing the reference screenshot. For now, here are the base guidelines inspired by AbacatePay's approach:

```json
{
  "designSystem": {
    "name": "LivChat Design System",
    "version": "1.0",

    "principles": [
      "Developer-first: Show code, not marketing fluff",
      "Speed perception: Everything should feel instant",
      "Clarity over cleverness: Simple > Smart",
      "Trust through transparency: No hidden elements"
    ],

    "colors": {
      "primary": "#25D366",
      "primaryDark": "#128C7E",
      "secondary": "#18181B",
      "background": "#FFFFFF",
      "backgroundDark": "#0A0A0A",
      "surface": "#F9FAFB",
      "text": "#18181B",
      "textMuted": "#6B7280",
      "textOnDark": "#FFFFFF",
      "success": "#10B981",
      "warning": "#F59E0B",
      "error": "#EF4444",
      "accent": "#8B5CF6"
    },

    "typography": {
      "fontFamily": {
        "heading": "Inter, system-ui, sans-serif",
        "body": "Inter, system-ui, sans-serif",
        "code": "JetBrains Mono, Fira Code, monospace"
      },
      "scale": {
        "h1": "3.5rem (56px) - bold",
        "h2": "2.25rem (36px) - semibold",
        "h3": "1.5rem (24px) - semibold",
        "body": "1rem (16px) - regular",
        "small": "0.875rem (14px) - regular",
        "code": "0.875rem (14px) - regular"
      }
    },

    "spacing": {
      "section": "120px vertical padding",
      "container": "max-width 1200px, centered",
      "cardGap": "24px",
      "elementGap": "16px"
    },

    "components": {
      "buttons": {
        "primary": "bg-primary text-white rounded-lg px-6 py-3 font-medium hover:bg-primaryDark transition",
        "secondary": "bg-transparent border border-gray-300 rounded-lg px-6 py-3 font-medium hover:bg-gray-50 transition",
        "ghost": "text-primary hover:underline"
      },
      "cards": {
        "default": "bg-white rounded-xl p-6 shadow-sm border border-gray-100",
        "dark": "bg-gray-900 rounded-xl p-6 border border-gray-800",
        "interactive": "hover:shadow-md hover:border-primary/20 transition cursor-pointer"
      },
      "codeBlocks": {
        "style": "bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-100",
        "highlight": "syntax highlighting with Shiki or Prism"
      },
      "badges": {
        "default": "bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium"
      }
    },

    "animations": {
      "hover": "transform scale(1.02) on hover, 200ms ease",
      "fadeIn": "opacity 0 to 1, 300ms ease",
      "slideUp": "translateY(20px) to 0, 400ms ease"
    },

    "imagery": {
      "style": "Minimal, tech-focused, code-centric",
      "illustrations": "Abstract geometric shapes, connection lines",
      "screenshots": "Actual product UI, terminal windows, code editors",
      "avoid": "Stock photos of people, generic business imagery"
    }
  }
}
```

---

## Instructions for Design Mode

Please help me enhance this prompt with specific design guidelines based on the reference screenshot I will attach.

Analyze the screenshot and update the design.json above with:
1. Exact color values from the reference
2. Typography styles and weights
3. Spacing and layout patterns
4. Component styles (buttons, cards, inputs)
5. Animation and interaction patterns
6. Overall visual tone and aesthetic

The goal is to create a landing page that feels as polished and developer-friendly as AbacatePay, while maintaining LivChat.ai's unique identity as a WhatsApp API platform.


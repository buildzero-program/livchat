// ===========================================
// LivChat.ai - Mock Data for Development
// ===========================================

import type { LucideIcon } from "lucide-react";
import {
  Zap,
  CreditCard,
  Webhook,
  Bot,
  BarChart3,
  Shield,
  QrCode,
  DollarSign,
} from "lucide-react";

// Types
export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface Plan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  recommended?: boolean;
  cta: string;
}

export interface Testimonial {
  name: string;
  role: string;
  company: string;
  quote: string;
  avatar?: string;
}

export interface Company {
  name: string;
  logo?: string;
}

export interface CodeExample {
  language: string;
  code: string;
}

export interface MockMessageResponse {
  success: boolean;
  messageId: string;
  status: "sent" | "pending" | "failed";
  timestamp: string;
}

// Features
export const MOCK_FEATURES: Feature[] = [
  {
    icon: Zap,
    title: "Integração em 5 min",
    description: "Copy-paste o código, configure webhook, pronto.",
  },
  {
    icon: CreditCard,
    title: "Sem cartão",
    description: "50 mensagens grátis por dia. Upgrade quando quiser.",
  },
  {
    icon: Webhook,
    title: "Webhooks Realtime",
    description: "Retry automático com backoff exponencial.",
  },
  {
    icon: Bot,
    title: "AI Ready",
    description: "Integre com LangChain, CrewAI, n8n, Make, Zapier.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Dashboards prontos ou via API para seu BI.",
  },
  {
    icon: Shield,
    title: "Segurança Enterprise",
    description: "HMAC signing, LGPD compliant, criptografia E2E.",
  },
  {
    icon: QrCode,
    title: "QR codes dinâmicos",
    description: "Gere links wa.me programaticamente.",
  },
  {
    icon: DollarSign,
    title: "Preço transparente",
    description: "R$ 89/instância. Mensagens ilimitadas.",
  },
];

// Plans
export const MOCK_PLANS: Plan[] = [
  {
    name: "Free Developer",
    price: "R$ 0",
    description: "Perfeito para testar e desenvolver",
    features: [
      "1 Instância",
      "50 mensagens/dia",
      "API Completa",
      "Comunidade Discord",
    ],
    cta: "Começar Grátis",
  },
  {
    name: "Pro",
    price: "R$ 89",
    period: "/instância",
    description: "Para projetos em produção",
    features: [
      "Mensagens Ilimitadas",
      "Webhooks Realtime",
      "Painel de Controle",
      "Suporte Prioritário",
      "Múltiplos números",
    ],
    recommended: true,
    cta: "Assinar Pro",
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    description: "Para grandes operações",
    features: [
      "+20 Instâncias",
      "SLA Garantido",
      "Gerente de Conta",
      "Infraestrutura Dedicada",
      "White-label",
    ],
    cta: "Falar com Vendas",
  },
];

// Testimonials
export const MOCK_TESTIMONIALS: Testimonial[] = [
  {
    name: "Rafael Silva",
    role: "CTO",
    company: "TechStartup",
    quote:
      "Migramos do Twilio em 2 dias. A API é muito mais simples e o suporte responde em minutos.",
  },
  {
    name: "Ana Costa",
    role: "Head of Growth",
    company: "E-commerce Plus",
    quote:
      "Reduzimos 70% do custo com WhatsApp marketing. O ROI foi absurdo no primeiro mês.",
  },
  {
    name: "Lucas Mendes",
    role: "Founder",
    company: "AI Agency",
    quote:
      "Integrei com meu agente de IA em uma tarde. Agora tenho um assistente 24/7 no WhatsApp.",
  },
];

// Companies (Social Proof)
export const MOCK_COMPANIES: Company[] = [
  { name: "Rocketseat" },
  { name: "Vercel" },
  { name: "Nubank" },
  { name: "iFood" },
  { name: "PicPay" },
  { name: "VTEX" },
  { name: "Stone" },
];

// Code Examples
export const MOCK_CODE_EXAMPLES: Record<string, CodeExample> = {
  node: {
    language: "javascript",
    code: `import { LivChat } from '@livchat/sdk';

const client = new LivChat({
  apiKey: process.env.LIVCHAT_API_KEY
});

await client.send({
  to: '5511999999999',
  message: 'Olá! Seu pedido foi confirmado 🎉'
});`,
  },
  python: {
    language: "python",
    code: `from livchat import Client
import os

client = Client(api_key=os.getenv('LIVCHAT_API_KEY'))

response = client.send(
    to='5511999999999',
    message='Olá! Seu pedido foi confirmado 🎉'
)`,
  },
  php: {
    language: "php",
    code: `<?php
require_once 'vendor/autoload.php';

$client = new LivChat\\Client(getenv('LIVCHAT_API_KEY'));

$client->send([
    'to' => '5511999999999',
    'message' => 'Olá! Seu pedido foi confirmado 🎉'
]);`,
  },
};

// Tech Stack Badges
export const MOCK_TECH_BADGES = [
  "Node.js",
  "Python",
  "Go",
  "PHP",
  "Ruby",
  "Java",
  "C#",
  "Rust",
];

// Metrics
export const MOCK_METRICS = {
  messagesPerMonth: "5M+",
  activeDevs: "1k+",
  uptime: "99.9%",
  avgResponseTime: "< 200ms",
};

// Mock API Functions
export async function mockSendMessage(
  to: string,
  message: string
): Promise<MockMessageResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    success: true,
    messageId: `msg_${crypto.randomUUID().slice(0, 8)}`,
    status: "sent",
    timestamp: new Date().toISOString(),
  };
}

export async function mockGetQrCode(): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Returns a placeholder - in real app this would be base64 PNG
  return "mock-qr-code-data";
}

export async function mockCheckConnection(): Promise<{
  connected: boolean;
  phone?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    connected: true,
    phone: "5511999999999",
  };
}

// cURL example for TestPanel
export const MOCK_CURL_EXAMPLE = `curl -X POST https://api.livchat.ai/v1/send \\
  -H "Authorization: Bearer lc_anon_x9z..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "5511999999999",
    "message": "Olá! Teste de integração 🚀"
  }'`;

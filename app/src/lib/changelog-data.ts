// ===========================================
// LivChat.ai - Changelog Data
// ===========================================

import {
  Globe,
  Rocket,
  Link,
  ShieldCheck,
  Code,
  Filter,
  Key,
  Server,
  Gauge,
  Clock,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export interface ChangelogFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  features?: ChangelogFeature[];
  highlights?: string[];
  codeExample?: {
    language: string;
    code: string;
  };
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: "user-webhooks",
    version: "v1.2.0",
    date: "12 Dez 2024",
    title: "User Webhooks",
    description:
      "Configure seus próprios endpoints para receber eventos do WhatsApp em tempo real.",
    features: [
      {
        icon: Link,
        title: "Custom Endpoints",
        description:
          "Configure múltiplas URLs por organização com validação HTTPS",
      },
      {
        icon: ShieldCheck,
        title: "HMAC Signing",
        description: "Assinatura SHA-256 opcional para validação de payload",
      },
      {
        icon: Code,
        title: "Custom Headers",
        description: "Adicione headers HTTP customizados para autenticação",
      },
      {
        icon: Filter,
        title: "Event Filtering",
        description: "Filtre por instância e tipo de evento",
      },
    ],
    highlights: [
      "Status tracking: Success, failed, pending",
      "Latency monitoring em milliseconds",
      "Payload inspection completo",
      "Resend para entregas falhas",
      "Test events para verificar conectividade",
    ],
    codeExample: {
      language: "json",
      code: `{
  "event": "message.received",
  "timestamp": "2024-12-12T10:30:00.000Z",
  "instance": {
    "id": "uuid",
    "phone": "5511999999999"
  },
  "data": {
    "messageId": "ABC123",
    "from": "5511888888888",
    "type": "text",
    "body": "Hello!"
  }
}`,
    },
  },
  {
    id: "public-api",
    version: "v1.1.0",
    date: "10 Dez 2024",
    title: "Public API",
    description:
      "API oficial disponível em api.livchat.ai com segurança enterprise-grade.",
    features: [
      {
        icon: Globe,
        title: "Unified Endpoint",
        description: "Ponto único de entrada em api.livchat.ai",
      },
      {
        icon: Key,
        title: "HMAC Authentication",
        description: "Request signing seguro com SHA-256",
      },
      {
        icon: Server,
        title: "Multi-Instance",
        description: "Gerencie múltiplas instâncias com uma API key",
      },
      {
        icon: Gauge,
        title: "Rate Limiting",
        description: "Limites justos para garantir estabilidade",
      },
    ],
    codeExample: {
      language: "bash",
      code: `curl -X POST https://api.livchat.ai/chat/send/text \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "x-instance-id: YOUR_INSTANCE_ID" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "5511999999999", "message": "Hello!"}'`,
    },
  },
  {
    id: "launch",
    version: "v1.0.0",
    date: "8 Dez 2024",
    title: "LivChat.ai Launch",
    description:
      "Lançamento oficial da plataforma - WhatsApp API para desenvolvedores e martech.",
    features: [
      {
        icon: Rocket,
        title: "Zero Friction",
        description: "Conecte WhatsApp antes de criar conta - teste primeiro",
      },
      {
        icon: CreditCard,
        title: "Per-Instance Pricing",
        description:
          "Pague por instância, não por mensagem - custos previsíveis",
      },
      {
        icon: Clock,
        title: "Quick Integration",
        description: "Do zero ao envio de mensagens em minutos",
      },
      {
        icon: Code,
        title: "Built for Devs",
        description: "REST API limpa, webhooks e docs completos",
      },
    ],
    highlights: [
      "Multi-Device Support via WhatsApp Web protocol",
      "Rich Messages: texto, imagens, documentos, áudio, vídeo, localização",
      "Real-Time Events via webhooks",
      "Group Management completo",
      "Contact Management com avatars",
    ],
  },
];

// ===========================================
// LivChat.ai - Changelog Data
// ===========================================

import {
  Zap,
  Rocket,
  Key,
  Webhook,
  MessageSquare,
  Image,
  Settings,
  Palette,
  Shield,
  Gauge,
  Bot,
  Smartphone,
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
    id: "v1-launch",
    version: "v1.0.0",
    date: "22 Dez 2024",
    title: "LivChat.ai - Lançamento Oficial",
    description:
      "Primeira versão estável da plataforma. WhatsApp API completa para desenvolvedores, martech e AI agents. Do zero ao envio de mensagens em minutos.",
    features: [
      {
        icon: Zap,
        title: "Zero Friction",
        description:
          "Conecte seu WhatsApp antes de criar conta. Teste a API primeiro, crie conta depois.",
      },
      {
        icon: MessageSquare,
        title: "WhatsApp API Completa",
        description:
          "Envie texto, imagens, vídeos, áudio, documentos, localização e contatos.",
      },
      {
        icon: Key,
        title: "API Keys Automáticas",
        description:
          "Chaves geradas automaticamente ao conectar. Revele, regenere e gerencie pelo dashboard.",
      },
      {
        icon: Webhook,
        title: "User Webhooks",
        description:
          "Configure endpoints para receber eventos em tempo real com HMAC signing.",
      },
      {
        icon: Gauge,
        title: "Quota System",
        description:
          "Controle de uso em tempo real com Redis. Reset automático diário.",
      },
      {
        icon: Bot,
        title: "Assistente AI (Ivy)",
        description:
          "Chat integrado com streaming em tempo real. Powered by LangGraph.",
      },
      {
        icon: Settings,
        title: "Settings Modal",
        description:
          "Gerencie perfil, chave de API e aparência em um modal estilo Notion.",
      },
      {
        icon: Palette,
        title: "Adaptive Branding",
        description:
          "Favicon e tema adaptam automaticamente ao modo claro/escuro do sistema.",
      },
    ],
    highlights: [
      "Multi-Device Support via protocolo WhatsApp Web",
      "Validação automática de números brasileiros (9º dígito)",
      "OAuth popup direto para Google e GitHub",
      "Dashboard com métricas em tempo real",
      "Gerenciamento de múltiplas instâncias WhatsApp",
      "Webhook logs com retry automático e inspeção de payload",
      "API documentada em docs.livchat.ai (Mintlify)",
      "Roadmap público com sistema de votação",
    ],
    codeExample: {
      language: "bash",
      code: `# Envie sua primeira mensagem em segundos
curl -X POST https://api.livchat.ai/chat/send/text \\
  -H "Authorization: Bearer lc_live_sua_chave_aqui" \\
  -H "x-instance-id: sua_instancia" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "5511999999999", "message": "Hello from LivChat!"}'`,
    },
  },
];

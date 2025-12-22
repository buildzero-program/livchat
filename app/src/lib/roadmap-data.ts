import {
  MessageCircle,
  Calendar,
  Loader,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

export type RoadmapStatus = "review" | "planned" | "in_progress" | "launched";

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  votes: number;
  version?: string;
}

export const ROADMAP_STATUS_CONFIG: Record<
  RoadmapStatus,
  { label: string; icon: LucideIcon; color: string }
> = {
  review: {
    label: "Em Revisão",
    icon: MessageCircle,
    color: "text-muted-foreground",
  },
  planned: {
    label: "Planejado",
    icon: Calendar,
    color: "text-blue-400",
  },
  in_progress: {
    label: "Em Progresso",
    icon: Loader,
    color: "text-amber-400",
  },
  launched: {
    label: "Lançado",
    icon: CheckCircle,
    color: "text-green-400",
  },
};

export const ROADMAP_ITEMS: RoadmapItem[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // LANÇADO - v1.0.0 (22 Dez 2024)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "whatsapp-api",
    title: "WhatsApp API",
    description: "Envio de texto, imagens, vídeos, áudios, documentos e localização.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "zero-friction",
    title: "Zero Friction",
    description: "Conecte WhatsApp e teste a API antes de criar conta.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "multi-instance",
    title: "Multi-Instance",
    description: "Gerencie múltiplas conexões WhatsApp em uma única conta.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "api-keys",
    title: "API Keys",
    description: "Chaves geradas automaticamente com reveal, regenerate e revoke.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "user-webhooks",
    title: "User Webhooks",
    description: "Receba eventos em tempo real com HMAC signing e custom headers.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "quota-system",
    title: "Quota System",
    description: "Controle de uso em tempo real com Redis e reset diário.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Métricas, instâncias, quota e atividade em tempo real.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "settings-modal",
    title: "Settings",
    description: "Gerencie perfil, API key e aparência em modal estilo Notion.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "ivy-assistant",
    title: "Assistente AI (Ivy)",
    description: "Chat integrado com streaming em tempo real via LangGraph.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "multimodal",
    title: "Multimodal",
    description: "Envie imagens, grave áudios e anexe PDFs nas conversas com Ivy.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "api-docs",
    title: "API Docs",
    description: "Documentação interativa completa em docs.livchat.ai.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "roadmap-votes",
    title: "Roadmap Público",
    description: "Vote nas features que você mais quer ver implementadas.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EM PROGRESSO - Sendo desenvolvido agora
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "ai-workflows-api",
    title: "AI Workflows API",
    description: "API pública para criar e executar workflows de AI personalizados via api.livchat.ai.",
    status: "in_progress",
    votes: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANEJADO - Próximas features confirmadas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "ivy-actions",
    title: "Ivy Actions",
    description: "Ivy poderá executar ações reais: enviar mensagens, gerenciar instâncias.",
    status: "planned",
    votes: 0,
  },
  {
    id: "ai-billing",
    title: "AI Billing",
    description: "Contabilização de tokens com suporte a BYOK (Bring Your Own Key).",
    status: "planned",
    votes: 0,
  },
  {
    id: "inbox",
    title: "Inbox",
    description: "Caixa de entrada unificada para todas as conversas WhatsApp.",
    status: "planned",
    votes: 0,
  },
  {
    id: "chat-widget",
    title: "Chat Widget",
    description: "Widget de chat para embedar em sites e landing pages.",
    status: "planned",
    votes: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EM REVISÃO - Ideias da comunidade
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "n8n-integration",
    title: "Integração n8n",
    description: "Node nativo no marketplace do n8n para automações.",
    status: "review",
    votes: 0,
  },
  {
    id: "make-integration",
    title: "Integração Make",
    description: "Connector oficial com Make (Integromat).",
    status: "review",
    votes: 0,
  },
  {
    id: "zapier-integration",
    title: "Integração Zapier",
    description: "Ações nativas no Zapier para automações.",
    status: "review",
    votes: 0,
  },
  {
    id: "chatwoot-integration",
    title: "Integração Chatwoot",
    description: "Conecte LivChat como canal no Chatwoot.",
    status: "review",
    votes: 0,
  },
  {
    id: "sdk-python",
    title: "SDK Python",
    description: "SDK oficial para Django, FastAPI e Python vanilla.",
    status: "review",
    votes: 0,
  },
  {
    id: "sdk-typescript",
    title: "SDK TypeScript",
    description: "SDK type-safe para Node.js, Deno e Bun.",
    status: "review",
    votes: 0,
  },
  {
    id: "bulk-send",
    title: "Bulk Send",
    description: "Envio em massa com rate limiting inteligente.",
    status: "review",
    votes: 0,
  },
  {
    id: "message-templates",
    title: "Templates",
    description: "Templates pré-configurados para mensagens.",
    status: "review",
    votes: 0,
  },
  {
    id: "scheduling",
    title: "Agendamento",
    description: "Agendar envio de mensagens para horários específicos.",
    status: "review",
    votes: 0,
  },
];

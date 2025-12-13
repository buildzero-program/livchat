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
  // Em Revisão - Ideias da comunidade, ainda não priorizadas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "chatwoot-integration",
    title: "Integração Chatwoot",
    description: "Conecte LivChat como canal de API no Chatwoot para gerenciar conversas.",
    status: "review",
    votes: 0,
  },
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
    title: "Bulk Send API",
    description: "Envio em massa com rate limiting inteligente e relatórios.",
    status: "review",
    votes: 0,
  },
  {
    id: "message-templates",
    title: "Message Templates",
    description: "Templates pré-aprovados para mensagens de marketing.",
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
  {
    id: "contacts-api",
    title: "Contacts API",
    description: "Gerenciar contatos e listas de broadcast via API.",
    status: "review",
    votes: 0,
  },
  {
    id: "cli-tool",
    title: "CLI Tool",
    description: "Gerenciar instâncias e enviar mensagens direto do terminal.",
    status: "review",
    votes: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Planejado - Próximas features confirmadas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "ai-agents",
    title: "Agentes AI",
    description: "Crie e conecte agentes AI (LangChain, LangGraph) aos seus números WhatsApp.",
    status: "planned",
    votes: 0,
  },
  {
    id: "ai-assistant",
    title: "Assistente AI Interno",
    description: "Assistente AI nativo do LivChat para ajudar na plataforma.",
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
  {
    id: "inbox",
    title: "Inbox / Caixa de Entrada",
    description: "Acompanhe todas as conversas dos seus números em um só lugar.",
    status: "planned",
    votes: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Em Progresso - Sendo desenvolvido agora
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "dashboard-widgets",
    title: "Dashboard com Dados Reais",
    description: "Widgets de instâncias, métricas, quota e atividade com dados em tempo real.",
    status: "in_progress",
    votes: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Lançado - Features já disponíveis
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "roadmap-votes",
    title: "Sistema de Votos",
    description: "Vote nas features que você mais quer ver implementadas.",
    status: "launched",
    votes: 0,
    version: "v1.2.0",
  },
  {
    id: "user-webhooks",
    title: "User Webhooks",
    description: "Configure endpoints para receber eventos WhatsApp em tempo real com HMAC.",
    status: "launched",
    votes: 0,
    version: "v1.2.0",
  },
  {
    id: "api-docs",
    title: "Documentação API",
    description: "Documentação interativa completa em docs.livchat.ai.",
    status: "launched",
    votes: 0,
    version: "v1.1.0",
  },
  {
    id: "public-api",
    title: "Public API",
    description: "REST API completa em api.livchat.ai com autenticação HMAC.",
    status: "launched",
    votes: 0,
    version: "v1.1.0",
  },
  {
    id: "zero-friction",
    title: "Zero Friction Auth",
    description: "Conecte WhatsApp e teste a API antes de criar conta.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "multi-device",
    title: "Multi-Device Support",
    description: "Suporte ao protocolo WhatsApp Web multi-dispositivo.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "text-media",
    title: "Text & Media Messages",
    description: "Envio de texto, imagens, vídeos, áudios e documentos.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
  {
    id: "quota-system",
    title: "Sistema de Quotas",
    description: "Limites por instância com Redis e reset diário automático.",
    status: "launched",
    votes: 0,
    version: "v1.0.0",
  },
];

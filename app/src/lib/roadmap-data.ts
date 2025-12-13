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
  version?: string; // Para items lançados
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
  // Em Revisão
  {
    id: "graphql-api",
    title: "GraphQL API",
    description: "Alternativa ao REST para queries mais flexíveis e eficientes.",
    status: "review",
    votes: 34,
  },
  {
    id: "cli-tool",
    title: "CLI Tool",
    description: "Gerenciar instâncias e enviar mensagens direto do terminal.",
    status: "review",
    votes: 28,
  },
  {
    id: "bulk-send",
    title: "Bulk Send API",
    description: "Envio em massa com rate limiting inteligente e relatórios.",
    status: "review",
    votes: 156,
  },
  {
    id: "php-sdk",
    title: "SDK PHP",
    description: "SDK oficial para Laravel, Symfony e PHP vanilla.",
    status: "review",
    votes: 42,
  },
  {
    id: "rust-sdk",
    title: "SDK Rust",
    description: "SDK de alta performance para aplicações Rust.",
    status: "review",
    votes: 18,
  },
  {
    id: "templates",
    title: "Message Templates",
    description: "Templates pré-aprovados para mensagens de marketing.",
    status: "review",
    votes: 67,
  },
  {
    id: "scheduling",
    title: "Agendamento",
    description: "Agendar envio de mensagens para horários específicos.",
    status: "review",
    votes: 89,
  },
  {
    id: "contacts-api",
    title: "Contacts API",
    description: "Gerenciar contatos e listas de broadcast via API.",
    status: "review",
    votes: 45,
  },

  // Planejado
  {
    id: "go-sdk",
    title: "SDK Go",
    description: "SDK type-safe com todos os métodos da API.",
    status: "planned",
    votes: 64,
  },
  {
    id: "n8n-plugin",
    title: "Plugin n8n",
    description: "Connector nativo no marketplace do n8n.",
    status: "planned",
    votes: 89,
  },
  {
    id: "make-connector",
    title: "Connector Make",
    description: "Integração oficial com Make (Integromat).",
    status: "planned",
    votes: 47,
  },
  {
    id: "zapier-action",
    title: "Zapier Action",
    description: "Ações nativas no Zapier para automações.",
    status: "planned",
    votes: 112,
  },
  {
    id: "webhook-filters",
    title: "Webhook Filters",
    description: "Filtrar eventos antes de enviar ao seu endpoint.",
    status: "planned",
    votes: 56,
  },
  {
    id: "ip-whitelist",
    title: "IP Whitelist",
    description: "Restringir acesso à API por IP.",
    status: "planned",
    votes: 34,
  },

  // Em Progresso
  {
    id: "retry-exponential",
    title: "Retry Automático",
    description: "Retry exponencial até 48h com backoff inteligente.",
    status: "in_progress",
    votes: 127,
  },
  {
    id: "rate-limiting",
    title: "Rate Limiting",
    description: "Controle granular de rate limits por instância.",
    status: "in_progress",
    votes: 95,
  },
  {
    id: "dashboard-analytics",
    title: "Dashboard Analytics",
    description: "Métricas de uso, entregas e performance em tempo real.",
    status: "in_progress",
    votes: 203,
  },
  {
    id: "message-status",
    title: "Status de Mensagem",
    description: "Tracking detalhado: enviado, entregue, lido.",
    status: "in_progress",
    votes: 178,
  },
  {
    id: "media-upload",
    title: "Media Upload",
    description: "Upload de mídia via API com CDN otimizado.",
    status: "in_progress",
    votes: 89,
  },

  // Lançado
  {
    id: "webhooks-hmac",
    title: "Webhooks HMAC",
    description: "Assinatura HMAC-SHA256 para validar webhooks.",
    status: "launched",
    votes: 89,
    version: "v1.2.0",
  },
  {
    id: "public-api",
    title: "Public API",
    description: "REST API completa com documentação OpenAPI.",
    status: "launched",
    votes: 234,
    version: "v1.1.0",
  },
  {
    id: "multi-device",
    title: "Multi-Device Support",
    description: "Suporte ao protocolo WhatsApp Web multi-dispositivo.",
    status: "launched",
    votes: 312,
    version: "v1.0.0",
  },
  {
    id: "qr-code",
    title: "QR Code Auth",
    description: "Autenticação via QR Code com reconexão automática.",
    status: "launched",
    votes: 256,
    version: "v1.0.0",
  },
  {
    id: "text-messages",
    title: "Text Messages",
    description: "Envio de mensagens de texto simples.",
    status: "launched",
    votes: 445,
    version: "v1.0.0",
  },
  {
    id: "media-messages",
    title: "Media Messages",
    description: "Envio de imagens, vídeos, áudios e documentos.",
    status: "launched",
    votes: 389,
    version: "v1.0.0",
  },
];

// Helper para filtrar por status
export function getItemsByStatus(status: RoadmapStatus): RoadmapItem[] {
  return ROADMAP_ITEMS.filter((item) => item.status === status).sort(
    (a, b) => b.votes - a.votes
  );
}

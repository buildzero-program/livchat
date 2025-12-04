/**
 * Mock data para o Dashboard - Conceito visual
 * Dados fictícios para desenvolvimento do layout
 */

// Métricas de hoje
export const mockMetricsToday = {
  messagesSent: 47,
  messagesReceived: 123,
  totalMessages: 170,
  dataSentBytes: 2621440, // 2.5 MB
  dataReceivedBytes: 15728640, // 15 MB
  comparison: {
    percentage: 12,
    trend: "up" as const,
  },
};

// Dados dos últimos 7 dias para chart
export const mockWeekData = [
  { date: "Seg", sent: 45, received: 78, total: 123 },
  { date: "Ter", sent: 32, received: 53, total: 85 },
  { date: "Qua", sent: 89, received: 111, total: 200 },
  { date: "Qui", sent: 67, received: 83, total: 150 },
  { date: "Sex", sent: 41, received: 49, total: 90 },
  { date: "Sáb", sent: 18, received: 27, total: 45 },
  { date: "Hoje", sent: 47, received: 123, total: 170 },
];

// Dados do mês para quota
export type PlanType = "free" | "starter" | "scale";

export const mockMonthUsage: {
  used: number;
  limit: number;
  percentage: number;
  daysRemaining: number;
  plan: PlanType;
} = {
  used: 1247,
  limit: 1500,
  percentage: 83,
  daysRemaining: 12,
  plan: "starter",
};

// Status da conexão
export const mockConnection = {
  connected: true,
  loggedIn: true,
  jid: "5511948182061@s.whatsapp.net",
  phoneNumber: "+55 11 94818-2061",
  deviceName: "iPhone de Pedro",
  connectedSince: new Date(Date.now() - 2 * 60 * 60 * 1000 - 34 * 60 * 1000), // 2h 34min atrás
  lastActivity: new Date(Date.now() - 3 * 60 * 1000), // 3 min atrás
};

// Atividade recente
export const mockRecentActivity = [
  {
    id: "1",
    type: "message_sent" as const,
    contact: "João Silva",
    contactInitials: "JS",
    message: "Oi, tudo bem?",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    status: "delivered" as const,
  },
  {
    id: "2",
    type: "message_received" as const,
    contact: "Maria Santos",
    contactInitials: "MS",
    message: "Pode me enviar o relatório?",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    status: "read" as const,
  },
  {
    id: "3",
    type: "webhook_triggered" as const,
    contact: "Sistema",
    contactInitials: "WH",
    message: "Novo pedido #12345",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    status: "success" as const,
  },
  {
    id: "4",
    type: "message_sent" as const,
    contact: "Pedro Oliveira",
    contactInitials: "PO",
    message: "Confirmado para amanhã!",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: "delivered" as const,
  },
  {
    id: "5",
    type: "connected" as const,
    contact: "Sistema",
    contactInitials: "LC",
    message: "WhatsApp conectado",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 - 34 * 60 * 1000),
    status: "success" as const,
  },
];

// Último envio do teste rápido
export const mockLastTest = {
  phone: "+55 85 98864-4401",
  contactName: "Suporte LivChat",
  message: "Teste de integração via API",
  timestamp: new Date(Date.now() - 5 * 60 * 1000),
  status: "delivered" as const,
  messageId: "3EB0F82A1B3C4D5E6F",
};

// Helpers
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) {
    const mins = diffMins % 60;
    return mins > 0 ? `há ${diffHours}h ${mins}min` : `há ${diffHours}h`;
  }
  return `há ${diffDays} dias`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatPhoneNumber(jid: string): string {
  const number = jid.replace("@s.whatsapp.net", "");
  if (number.startsWith("55") && number.length === 13) {
    return `+${number.slice(0, 2)} ${number.slice(2, 4)} ${number.slice(4, 9)}-${number.slice(9)}`;
  }
  return `+${number}`;
}

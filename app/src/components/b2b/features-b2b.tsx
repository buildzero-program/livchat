"use client";

import { motion } from "framer-motion";
import {
  MessageSquare,
  Bot,
  Zap,
  BarChart3,
  Clock,
  Shield,
  Code,
  Workflow,
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "Agentes AI Inteligentes",
    description:
      "IA que qualifica leads, responde duvidas, agenda reunioes e converte — tudo automaticamente, 24/7.",
    color: "emerald",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp API Robusta",
    description:
      "API nao-oficial estavel, sem limite de mensagens. Conecte em 30 segundos com QR code.",
    color: "violet",
  },
  {
    icon: Workflow,
    title: "Fluxos Personalizaveis",
    description:
      "Crie workflows visuais ou deixe a IA criar pra voce. Do simples ao complexo, sem codigo.",
    color: "amber",
  },
  {
    icon: Zap,
    title: "Respostas em Segundos",
    description:
      "Leads de campanha recebem resposta imediata. Nao perca mais vendas por demora no atendimento.",
    color: "emerald",
  },
  {
    icon: BarChart3,
    title: "Dashboard Completo",
    description:
      "Metricas de conversao, taxa de resposta, leads qualificados. Tudo que voce precisa pra otimizar.",
    color: "violet",
  },
  {
    icon: Code,
    title: "Dev-Friendly",
    description:
      "API REST, webhooks, documentacao completa. Integra com LangChain, CrewAI, N8N, Make.",
    color: "amber",
  },
  {
    icon: Clock,
    title: "Implementacao Assistida",
    description:
      "Nao e so API. Ajudamos voce a configurar fluxos completos de atendimento para suas campanhas.",
    color: "emerald",
  },
  {
    icon: Shield,
    title: "Sem Limite de Mensagens",
    description:
      "Pricing por instancia, nao por mensagem. Escale sem preocupacao com custos variaveis.",
    color: "violet",
  },
];

const colorMap = {
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    glow: "group-hover:shadow-emerald-500/10",
  },
  violet: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    text: "text-violet-400",
    glow: "group-hover:shadow-violet-500/10",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    glow: "group-hover:shadow-amber-500/10",
  },
};

export function FeaturesB2B() {
  return (
    <section id="funcionalidades" className="relative py-24 px-6 bg-[#050508]">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
            <Zap className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs font-[family-name:var(--font-body)] font-medium text-violet-400">
              Funcionalidades
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Tudo que sua agencia precisa para{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-violet-400 bg-clip-text text-transparent">
              escalar atendimento
            </span>
          </h2>
          <p className="font-[family-name:var(--font-body)] text-lg text-white/50 max-w-2xl mx-auto">
            API de WhatsApp + Agentes AI em uma unica plataforma. Dev-friendly,
            sem limite de mensagens, com suporte real.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature, index) => {
            const colors = colorMap[feature.color as keyof typeof colorMap];
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className={`group relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 hover:shadow-xl ${colors.glow}`}
              >
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-xl ${colors.bg} ${colors.border} border mb-5 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className={`h-6 w-6 ${colors.text}`} />
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm font-[family-name:var(--font-body)] text-white/50 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

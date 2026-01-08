"use client";

import { motion } from "framer-motion";
import { MessageSquare, Bot, CalendarCheck, TrendingUp, ArrowRight } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Lead entra pela campanha",
    description:
      "Anuncio no Meta/Google gera lead que manda mensagem no WhatsApp. A IA responde instantaneamente.",
    color: "emerald",
  },
  {
    number: "02",
    icon: Bot,
    title: "IA qualifica automaticamente",
    description:
      "Perguntas de qualificacao personalizadas. A IA identifica se e lead quente, morno ou frio.",
    color: "violet",
  },
  {
    number: "03",
    icon: CalendarCheck,
    title: "Agenda reuniao ou envia proposta",
    description:
      "Lead qualificado? A IA agenda direto na sua agenda. Ou envia proposta/catalogo automaticamente.",
    color: "amber",
  },
  {
    number: "04",
    icon: TrendingUp,
    title: "Voce fecha a venda",
    description:
      "Receba leads quentes no seu CRM, prontos pra fechar. Acompanhe metricas em tempo real.",
    color: "emerald",
  },
];

const colorMap = {
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    number: "bg-emerald-500 text-white",
  },
  violet: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    text: "text-violet-400",
    number: "bg-violet-500 text-white",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    number: "bg-amber-500 text-white",
  },
};

export function HowItWorksB2B() {
  return (
    <section id="como-funciona" className="relative py-24 px-6 bg-[#0A0A0F]">
      {/* Top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-[family-name:var(--font-body)] font-medium text-emerald-400">
              Como Funciona
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Do lead a venda em{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-violet-400 bg-clip-text text-transparent">
              4 passos simples
            </span>
          </h2>
          <p className="font-[family-name:var(--font-body)] text-lg text-white/50 max-w-2xl mx-auto">
            Automatize o atendimento das suas campanhas e foque no que importa: fechar vendas.
          </p>
        </motion.div>

        {/* Steps - Timeline Style */}
        <div className="relative">
          {/* Connection Lines between steps (Desktop only) - 3 separate lines with gaps */}
          {/* Line 1: Step 1 (emerald) → Step 2 (violet) */}
          <div className="hidden lg:block absolute top-[40px] left-[calc(12.5%+52px)] w-[calc(25%-104px)] h-[2px] bg-gradient-to-r from-emerald-500/40 to-violet-500/40" />
          {/* Line 2: Step 2 (violet) → Step 3 (amber) */}
          <div className="hidden lg:block absolute top-[40px] left-[calc(37.5%+52px)] w-[calc(25%-104px)] h-[2px] bg-gradient-to-r from-violet-500/40 to-amber-500/40" />
          {/* Line 3: Step 3 (amber) → Step 4 (emerald) */}
          <div className="hidden lg:block absolute top-[40px] left-[calc(62.5%+52px)] w-[calc(25%-104px)] h-[2px] bg-gradient-to-r from-amber-500/40 to-emerald-500/40" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, index) => {
              const colors = colorMap[step.color as keyof typeof colorMap];
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="relative"
                >
                  <div className="flex flex-col items-center text-center">
                    {/* Icon Container */}
                    <div className="relative mb-8">
                      {/* Glow */}
                      <div className={`absolute inset-0 ${colors.bg} rounded-2xl blur-xl scale-150 opacity-50`} />

                      {/* Icon Box */}
                      <div
                        className={`relative z-10 flex items-center justify-center w-20 h-20 rounded-2xl ${colors.bg} ${colors.border} border-2 bg-[#0A0A0F]`}
                      >
                        <step.icon className={`h-9 w-9 ${colors.text}`} />
                      </div>

                      {/* Step Number */}
                      <div
                        className={`absolute -top-3 -right-3 z-20 flex items-center justify-center w-8 h-8 rounded-full ${colors.number} text-sm font-bold font-[family-name:var(--font-display)] shadow-lg`}
                      >
                        {step.number}
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-sm font-[family-name:var(--font-body)] text-white/50 leading-relaxed max-w-xs">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import { Check, X, AlertTriangle } from "lucide-react";

const PROBLEMS = [
  "Leads de campanha demoram pra receber resposta",
  "Atendimento manual nao escala",
  "Perde vendas por falta de follow-up",
  "Nao consegue atender fora do horario comercial",
  "Equipe sobrecarregada com leads frios",
];

const SOLUTIONS = [
  "Resposta instantanea 24/7 via IA",
  "Escala infinita sem aumentar equipe",
  "Follow-up automatico e personalizado",
  "Atendimento ativo mesmo de madrugada",
  "IA filtra leads — voce foca nos quentes",
];

export function SolutionB2B() {
  return (
    <section id="solucao" className="relative py-24 px-6 bg-[#050508]">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-[family-name:var(--font-body)] font-medium text-amber-400">
              O Problema
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Sua agencia{" "}
            <span className="relative">
              <span className="relative z-10 text-red-400">perde vendas</span>
              <span className="absolute bottom-1 left-0 w-full h-2 bg-red-500/20 -skew-x-2" />
            </span>{" "}
            por atendimento lento?
          </h2>
          <p className="font-[family-name:var(--font-body)] text-lg text-white/50 max-w-2xl mx-auto">
            Campanhas de trafego geram leads. Mas sem atendimento rapido e qualificado,
            esses leads esfriam — e voce joga dinheiro fora.
          </p>
        </motion.div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-red-500/5 rounded-3xl blur-xl group-hover:bg-red-500/10 transition-colors" />
            <div className="relative p-8 rounded-3xl border border-red-500/20 bg-[#0A0A0F]/80 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <X className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-white">
                    Sem LivChat
                  </h3>
                  <p className="text-sm text-white/40">Atendimento tradicional</p>
                </div>
              </div>
              <ul className="space-y-4">
                {PROBLEMS.map((problem, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10"
                  >
                    <X className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-sm font-[family-name:var(--font-body)] text-white/70">
                      {problem}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-emerald-500/5 rounded-3xl blur-xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="relative p-8 rounded-3xl border border-emerald-500/20 bg-[#0A0A0F]/80 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <Check className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-white">
                    Com LivChat
                  </h3>
                  <p className="text-sm text-white/40">Atendimento com IA</p>
                </div>
              </div>
              <ul className="space-y-4">
                {SOLUTIONS.map((solution, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
                  >
                    <Check className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-sm font-[family-name:var(--font-body)] text-white">
                      {solution}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

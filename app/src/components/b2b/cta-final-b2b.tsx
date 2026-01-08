"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "~/components/ui/button";

export function CTAFinalB2B() {
  return (
    <section className="relative py-32 px-6 overflow-hidden bg-[#050508]">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-violet-500/5" />

      {/* Gradient Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          {/* Icon Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-8"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/30 rounded-3xl blur-xl" />
              <div className="relative flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-violet-500/20 border border-white/10">
                <Sparkles className="h-10 w-10 text-emerald-400" />
              </div>
            </div>
          </motion.div>

          {/* Headline */}
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-6 leading-tight">
            Pronto para{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-violet-400 bg-clip-text text-transparent">
              escalar seu atendimento
            </span>{" "}
            com IA?
          </h2>

          <p className="font-[family-name:var(--font-body)] text-lg md:text-xl text-white/50 mb-10 max-w-2xl mx-auto">
            Fale com um especialista e descubra como a LivChat pode automatizar o
            atendimento das suas campanhas de trafego.
          </p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link href="https://wa.me/5511948182061?text=Oi!%20Quero%20entender%20como%20a%20LivChat%20pode%20ajudar%20minha%20ag%C3%AAncia%20a%20converter%20mais%20leads.">
              <Button
                size="lg"
                className="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold font-[family-name:var(--font-body)] shadow-2xl shadow-emerald-500/30 border-0 px-10 h-14 text-lg group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Falar com Especialista
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="font-[family-name:var(--font-body)] text-sm text-white/40 mt-6"
          >
            Sem compromisso. Resposta em ate 24h.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

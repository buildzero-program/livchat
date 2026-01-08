"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Play, ArrowRight, Sparkles, TrendingUp, Clock, Users } from "lucide-react";

import { Button } from "~/components/ui/button";

const STATS = [
  { icon: Users, value: "+50", label: "Agencias ativas", color: "text-emerald-400" },
  { icon: TrendingUp, value: "+100k", label: "Mensagens/mes", color: "text-violet-400" },
  { icon: Clock, value: "24/7", label: "Atendimento IA", color: "text-amber-400" },
];

export function HeroB2B() {
  return (
    <section className="relative min-h-screen pt-28 pb-20 px-6 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[#050508]" />

      {/* Gradient Orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-violet-500/20 rounded-full blur-[128px] pointer-events-none" />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-[family-name:var(--font-body)] font-medium text-emerald-400">
              IA de atendimento para agencias de marketing
            </span>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center lg:text-left"
          >
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6">
              Automatize o{" "}
              <span className="relative">
                <span className="relative z-10 bg-gradient-to-r from-emerald-400 via-emerald-300 to-violet-400 bg-clip-text text-transparent">
                  atendimento de leads
                </span>
                <span className="absolute bottom-2 left-0 w-full h-3 bg-emerald-500/20 -skew-x-3" />
              </span>{" "}
              das suas campanhas
            </h1>

            <p className="font-[family-name:var(--font-body)] text-lg md:text-xl text-white/60 mb-8 max-w-xl mx-auto lg:mx-0">
              API de WhatsApp + Agentes AI para agencias. Qualifique leads, agende reunioes e converta mais — 24/7, sem aumentar equipe.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <Link href="https://wa.me/5511948182061?text=Oi!%20Quero%20entender%20como%20a%20LivChat%20pode%20ajudar%20minha%20ag%C3%AAncia%20a%20converter%20mais%20leads.">
                <Button
                  size="lg"
                  className="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold font-[family-name:var(--font-body)] shadow-xl shadow-emerald-500/30 border-0 px-8 h-12 text-base group"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Falar com Especialista
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </Link>
              <Link href="#demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/5 font-[family-name:var(--font-body)] h-12 px-8 text-base group"
                >
                  <Play className="h-4 w-4 mr-2 text-violet-400 group-hover:scale-110 transition-transform" />
                  Ver demonstracao
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-8">
              {STATS.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-white">
                      {stat.value}
                    </div>
                    <div className="text-xs font-[family-name:var(--font-body)] text-white/50">
                      {stat.label}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Dashboard Image with Floating Effect */}
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-violet-500/20 blur-3xl scale-110 opacity-50" />

              {/* Browser Frame */}
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
                {/* Browser Bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1f] border-b border-white/[0.06]">
                  <div className="flex gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-3.5 h-3.5 rounded-full bg-[#febc2e]" />
                    <div className="w-3.5 h-3.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 max-w-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="text-xs text-white/40 font-mono">app.livchat.ai</span>
                    </div>
                  </div>
                </div>

                {/* Dashboard Image - fills the frame without gaps */}
                <Image
                  src="/images/dashboard-mockup.png"
                  alt="LivChat Dashboard"
                  width={800}
                  height={600}
                  className="w-full h-auto block"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>

              {/* Floating Card - QR Code Teaser */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="absolute -bottom-6 -left-6 p-4 rounded-xl bg-[#111116]/90 backdrop-blur-xl border border-white/10 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Conecte em 30s</div>
                    <div className="text-xs text-white/50">QR Code ou numero</div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Card - Metrics */}
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="absolute -top-4 -right-4 p-4 rounded-xl bg-[#111116]/90 backdrop-blur-xl border border-white/10 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">+127%</div>
                    <div className="text-xs text-white/50">Conversao</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

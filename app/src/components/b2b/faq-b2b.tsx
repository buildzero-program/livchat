"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

const FAQS = [
  {
    question: "O que exatamente a LivChat faz?",
    answer:
      "LivChat e uma plataforma que combina API de WhatsApp com Agentes de IA. Automatizamos o atendimento de leads de campanhas de trafego: a IA responde instantaneamente, qualifica o lead, agenda reunioes e envia propostas — tudo 24/7, sem intervencao humana.",
  },
  {
    question: "A API do WhatsApp e oficial?",
    answer:
      "Usamos uma API nao-oficial, mas extremamente estavel e utilizada por milhares de empresas. A vantagem e que voce pode conectar qualquer numero de WhatsApp em segundos, sem precisar de conta business verificada ou passar por aprovacao da Meta.",
  },
  {
    question: "Como funciona o pricing?",
    answer:
      "Cobramos por instancia (numero de WhatsApp conectado), nao por mensagem. Isso significa que voce pode enviar quantas mensagens quiser sem custo adicional. O modelo e previsivel e escala bem para operacoes de alto volume.",
  },
  {
    question: "Preciso saber programar?",
    answer:
      "Nao. Oferecemos implementacao assistida — configuramos os fluxos de atendimento junto com voce. Se voce ou sua equipe tem conhecimento tecnico, tambem disponibilizamos API REST e webhooks para integracoes customizadas.",
  },
  {
    question: "Quanto tempo leva pra implementar?",
    answer:
      "Uma implementacao basica pode estar rodando em poucos dias. Implementacoes mais complexas, com fluxos personalizados e integracoes, levam de 1 a 2 semanas. Tudo depende da complexidade da sua operacao.",
  },
  {
    question: "Integra com meu CRM?",
    answer:
      "Sim. Integramos com RD Station, Pipedrive, HubSpot, Salesforce e qualquer CRM que tenha API. Tambem conectamos com ferramentas de automacao como N8N, Make e Zapier.",
  },
  {
    question: "E se o lead quiser falar com humano?",
    answer:
      "A IA identifica quando o lead precisa de atendimento humano e transfere automaticamente para sua equipe. Voce recebe notificacao e pode assumir a conversa a qualquer momento.",
  },
  {
    question: "Voces oferecem suporte?",
    answer:
      "Sim. Alem da implementacao assistida inicial, oferecemos suporte continuo via WhatsApp. Nao e so documentacao — e parceria de verdade.",
  },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onClick,
  index,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-2xl border transition-all duration-300 ${
        isOpen
          ? "bg-white/[0.03] border-emerald-500/30"
          : "bg-transparent border-white/[0.06] hover:border-white/10"
      }`}
    >
      <button
        onClick={onClick}
        className="flex items-center justify-between w-full p-5 text-left"
      >
        <span className="font-[family-name:var(--font-display)] text-base font-medium text-white pr-4">
          {question}
        </span>
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 ${
            isOpen
              ? "bg-emerald-500/20 rotate-180"
              : "bg-white/5"
          }`}
        >
          <ChevronDown
            className={`h-4 w-4 transition-colors ${
              isOpen ? "text-emerald-400" : "text-white/50"
            }`}
          />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm font-[family-name:var(--font-body)] text-white/60 leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQB2B() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 px-6 bg-[#050508]">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
            <HelpCircle className="h-3.5 w-3.5 text-white/50" />
            <span className="text-xs font-[family-name:var(--font-body)] font-medium text-white/50">
              FAQ
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-white mb-4">
            Perguntas frequentes
          </h2>
          <p className="font-[family-name:var(--font-body)] text-lg text-white/50">
            Tire suas duvidas sobre a LivChat
          </p>
        </motion.div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {FAQS.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

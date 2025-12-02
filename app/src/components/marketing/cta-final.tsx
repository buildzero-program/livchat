"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Rocket, CreditCard, MessageSquare, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { PRICING } from "~/lib/constants";

const trustItems = [
  { icon: MessageSquare, text: `${PRICING.FREE_MESSAGES_PER_DAY} msgs/dia grátis` },
  { icon: CreditCard, text: "Sem cartão de crédito" },
  { icon: X, text: "Cancele quando quiser" },
];

export function CtaFinal() {
  return (
    <section className="py-24 px-6 bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Badge */}
          <span className="inline-block px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
            Você chegou no fim 🎉
          </span>

          {/* Title */}
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Pronto para começar?
          </h2>

          {/* Description */}
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Conecte seu WhatsApp em 30 segundos e envie sua primeira mensagem
            via API. Sem cadastro, sem complicação.
          </p>

          {/* CTA Button */}
          <Link href="#hero">
            <Button size="lg" className="text-lg px-8 py-6 h-auto">
              <Rocket className="h-5 w-5 mr-2" />
              Começar Agora
            </Button>
          </Link>

          {/* Trust Items */}
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            {trustItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.text}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { Button } from "~/components/ui/button";
import { MOCK_PLANS } from "~/lib/mock-data";
import { calculatePrice, PRICING } from "~/lib/constants";

export function Pricing() {
  const [instances, setInstances] = useState<number>(PRICING.STARTER_MIN_INSTANCES);

  return (
    <section id="pricing" className="py-24 px-6 bg-background">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">
            PREÇOS
          </span>
          <h2 className="mt-4 text-3xl md:text-4xl font-bold">
            Simples e transparente
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Pague por instância, não por mensagem. Escale conforme cresce.
          </p>
        </div>

        {/* Instance Slider */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto mb-16 p-8 bg-card rounded-xl border border-border"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Número de instâncias
            </span>
            <span className="text-2xl font-bold text-primary">{instances}</span>
          </div>

          <input
            type="range"
            min="1"
            max="20"
            value={instances}
            onChange={(e) => setInstances(Number(e.target.value))}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
          />

          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>1</span>
            <span>20+</span>
          </div>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground mb-1">Total mensal</p>
            <p className="text-4xl font-bold">
              R$ {calculatePrice(instances).toLocaleString("pt-BR")}
              <span className="text-lg font-normal text-muted-foreground">
                /mês
              </span>
            </p>
            {instances < PRICING.STARTER_MIN_INSTANCES && (
              <p className="mt-2 text-xs text-muted-foreground">
                Mínimo de {PRICING.STARTER_MIN_INSTANCES} instâncias no plano
                pago
              </p>
            )}
          </div>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {MOCK_PLANS.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-8 rounded-xl border ${
                plan.recommended
                  ? "border-primary bg-card scale-105 shadow-[0_0_40px_rgba(139,92,246,0.15)] z-10"
                  : "border-border bg-card"
              }`}
            >
              {/* Recommended Badge */}
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    Mais Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                className="w-full"
                variant={plan.recommended ? "default" : "outline"}
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

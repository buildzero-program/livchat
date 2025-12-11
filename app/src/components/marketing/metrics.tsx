"use client";

import { motion } from "framer-motion";
import { MOCK_METRICS } from "~/lib/mock-data";
import { LiveCounter } from "./live-counter";

// Static metrics (excluding messages - now live)
const metrics = [
  { value: MOCK_METRICS.activeDevs, label: "Devs Ativos" },
  { value: MOCK_METRICS.uptime, label: "Uptime" },
  { value: MOCK_METRICS.avgResponseTime, label: "Latência Média" },
];

export function Metrics() {
  return (
    <section className="py-16 px-6 bg-background">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold">
            Processando milhões de mensagens
          </h2>
          <p className="mt-2 text-muted-foreground">
            Infraestrutura robusta para escalar seu negócio
          </p>
        </div>

        {/* Live counter - prominent display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <LiveCounter />
        </motion.div>

        {/* Static metrics grid */}
        <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          {metrics.map((metric, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <p className="text-3xl md:text-4xl font-bold text-primary">
                {metric.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {metric.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

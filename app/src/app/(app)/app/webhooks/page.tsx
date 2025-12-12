"use client";

import { motion, type Variants } from "framer-motion";
import { WebhooksList } from "~/components/dashboard/webhooks-list";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

export default function WebhooksPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
        <p className="text-muted-foreground">
          Configure endpoints para receber eventos em tempo real
        </p>
      </motion.div>

      {/* Webhooks List */}
      <motion.div variants={itemVariants}>
        <WebhooksList />
      </motion.div>
    </motion.div>
  );
}

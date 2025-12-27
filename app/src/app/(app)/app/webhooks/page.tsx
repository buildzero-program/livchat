"use client";

import { motion } from "framer-motion";
import { WebhooksList } from "~/components/dashboard/webhooks-list";
import { pageVariants } from "~/lib/animations";

export default function WebhooksPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={pageVariants.container}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={pageVariants.item}>
        <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
        <p className="text-muted-foreground">
          Configure endpoints para receber eventos em tempo real
        </p>
      </motion.div>

      {/* Webhooks List */}
      <motion.div variants={pageVariants.item}>
        <WebhooksList />
      </motion.div>
    </motion.div>
  );
}

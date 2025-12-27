"use client";

import { motion } from "framer-motion";
import {
  InstancesWidget,
  MetricsWidget,
  QuotaWidget,
  ActivityWidget,
  QuickTestWidget,
} from "~/components/dashboard";
import { pageVariants } from "~/lib/animations";

export default function DashboardPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={pageVariants.container}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={pageVariants.item}>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral das suas instâncias e métricas
        </p>
      </motion.div>

      {/* Quick Test - Full Width */}
      <motion.div variants={pageVariants.item}>
        <QuickTestWidget />
      </motion.div>

      {/* Main Grid - 2x2 on desktop */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Row 1 */}
        <motion.div variants={pageVariants.item}>
          <InstancesWidget />
        </motion.div>

        <motion.div variants={pageVariants.item}>
          <MetricsWidget />
        </motion.div>

        {/* Row 2 */}
        <motion.div variants={pageVariants.item}>
          <QuotaWidget />
        </motion.div>

        <motion.div variants={pageVariants.item}>
          <ActivityWidget />
        </motion.div>
      </div>
    </motion.div>
  );
}

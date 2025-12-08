"use client";

import { motion, type Variants } from "framer-motion";
import {
  InstancesWidget,
  MetricsWidget,
  QuotaWidget,
  ActivityWidget,
  QuickTestWidget,
} from "~/components/dashboard";

// Animation variants for staggered entrance
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

export default function DashboardPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral das suas instâncias e métricas
        </p>
      </motion.div>

      {/* Quick Test - Full Width */}
      <motion.div variants={itemVariants}>
        <QuickTestWidget />
      </motion.div>

      {/* Main Grid - 2x2 on desktop */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Row 1 */}
        <motion.div variants={itemVariants}>
          <InstancesWidget />
        </motion.div>

        <motion.div variants={itemVariants}>
          <MetricsWidget />
        </motion.div>

        {/* Row 2 */}
        <motion.div variants={itemVariants}>
          <QuotaWidget />
        </motion.div>

        <motion.div variants={itemVariants}>
          <ActivityWidget />
        </motion.div>
      </div>
    </motion.div>
  );
}

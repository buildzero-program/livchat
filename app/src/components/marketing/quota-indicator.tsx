"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

// ═══════════════════════════════════════════════════════════════════════════
// QuotaIndicator Component
// Simplified animated quota display: "X restantes" + progress bar
// ═══════════════════════════════════════════════════════════════════════════

interface QuotaIndicatorProps {
  used: number;
  limit: number;
}

export function QuotaIndicator({ used, limit }: QuotaIndicatorProps) {
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isAtLimit = used >= limit;
  const isNearLimit = percentage >= 80 && !isAtLimit;

  // Animated remaining counter
  const remainingValue = useMotionValue(limit);
  const animatedRemaining = useTransform(remainingValue, (v) => Math.round(v));
  const prevUsed = useRef(used);

  useEffect(() => {
    const newRemaining = Math.max(0, limit - used);
    const controls = animate(remainingValue, newRemaining, {
      duration: 0.4,
      ease: "easeOut",
    });
    prevUsed.current = used;
    return controls.stop;
  }, [used, limit, remainingValue]);

  // Progress bar fills as quota is consumed (left to right)
  const progressWidth = Math.min(percentage, 100);

  // Color based on status
  const colorClass = isAtLimit
    ? "text-red-500"
    : isNearLimit
      ? "text-yellow-500"
      : "text-muted-foreground";

  const barColorClass = isAtLimit
    ? "bg-red-500"
    : isNearLimit
      ? "bg-yellow-500"
      : "bg-primary";

  return (
    <div className="flex items-center gap-2">
      {/* Remaining text */}
      <span className={`text-sm tabular-nums ${colorClass}`}>
        <motion.span className="font-medium">{animatedRemaining}</motion.span>
        {isAtLimit ? " esgotado" : " restantes"}
      </span>

      {/* Progress bar */}
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColorClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${progressWidth}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

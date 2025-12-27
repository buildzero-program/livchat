"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";

export type InstanceStatus = "online" | "connecting" | "offline";

interface StatusBadgeProps {
  status: InstanceStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (status === "online") {
    return (
      <Badge
        variant="default"
        className={`bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 ${className ?? ""}`}
      >
        <motion.span
          className="w-2 h-2 rounded-full mr-1.5 bg-green-500"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        Online
      </Badge>
    );
  }

  if (status === "connecting") {
    return (
      <Badge
        variant="secondary"
        className={`bg-yellow-500/10 text-yellow-600 border-yellow-500/20 ${className ?? ""}`}
      >
        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
        Conectando
      </Badge>
    );
  }

  return (
    <Badge
      variant="destructive"
      className={`bg-red-500/10 text-red-500 border-red-500/20 ${className ?? ""}`}
    >
      <span className="w-2 h-2 rounded-full mr-1.5 bg-red-500" />
      Offline
    </Badge>
  );
}

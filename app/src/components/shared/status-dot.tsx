"use client";

import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

export type InstanceStatus = "online" | "connecting" | "offline";

interface StatusDotProps {
  status: InstanceStatus;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-3 w-3",
};

const spinnerSizes = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

export function StatusDot({ status, size = "md" }: StatusDotProps) {
  if (status === "connecting") {
    return (
      <Loader2
        className={cn(
          "animate-spin text-yellow-500",
          spinnerSizes[size]
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "rounded-full inline-block flex-shrink-0",
        sizeClasses[size],
        status === "online" && "bg-green-500",
        status === "offline" && "bg-red-500"
      )}
    />
  );
}

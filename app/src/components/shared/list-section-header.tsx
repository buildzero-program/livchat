"use client";

import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface ListSectionHeaderProps {
  title: string;
  icon: LucideIcon;
  count: number;
  actions?: ReactNode;
  hideActionsWhenEmpty?: boolean;
}

export function ListSectionHeader({
  title,
  icon: Icon,
  count,
  actions,
  hideActionsWhenEmpty = false,
}: ListSectionHeaderProps) {
  const showActions = actions && (!hideActionsWhenEmpty || count > 0);

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">({count})</span>
      </div>
      {showActions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

"use client";

import { RoadmapCard } from "./roadmap-card";
import {
  type RoadmapStatus,
  type RoadmapItem,
  ROADMAP_STATUS_CONFIG,
} from "~/lib/roadmap-data";
import { cn } from "~/lib/utils";

interface RoadmapColumnProps {
  status: RoadmapStatus;
  items: RoadmapItem[];
}

export function RoadmapColumn({ status, items }: RoadmapColumnProps) {
  const config = ROADMAP_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col min-w-0 h-full overflow-hidden">
      {/* Header - fixo no topo da coluna */}
      <div className="flex-shrink-0 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("h-4 w-4", config.color)} />
          <h2 className={cn("font-semibold text-sm", config.color)}>
            {config.label}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </span>
      </div>

      {/* Cards Container com fade nas bordas */}
      <div className="relative flex-1 overflow-hidden">
        {/* Fade gradient top */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />

        {/* Scrollable content */}
        <div className="h-full overflow-y-auto scrollbar-hide space-y-3 pr-1 py-6">
          {items.map((item) => (
            <RoadmapCard key={item.id} item={item} />
          ))}

          {items.length === 0 && (
            <div className="p-4 rounded-lg border border-dashed border-border text-center">
              <p className="text-xs text-muted-foreground">Nenhum item</p>
            </div>
          )}
        </div>

        {/* Fade gradient bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  );
}

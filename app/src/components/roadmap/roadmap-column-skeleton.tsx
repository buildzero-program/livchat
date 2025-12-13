import { RoadmapCardSkeleton } from "./roadmap-card-skeleton";
import {
  type RoadmapStatus,
  ROADMAP_STATUS_CONFIG,
} from "~/lib/roadmap-data";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

interface RoadmapColumnSkeletonProps {
  status: RoadmapStatus;
  cardCount?: number;
}

export function RoadmapColumnSkeleton({
  status,
  cardCount = 3,
}: RoadmapColumnSkeletonProps) {
  const config = ROADMAP_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col min-w-0 h-full overflow-hidden">
      {/* Header - igual ao real */}
      <div className="flex-shrink-0 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("h-4 w-4", config.color)} />
          <h2 className={cn("font-semibold text-sm", config.color)}>
            {config.label}
          </h2>
        </div>
        <Skeleton className="h-3 w-12" />
      </div>

      {/* Cards Container com fade nas bordas */}
      <div className="relative flex-1 overflow-hidden">
        {/* Fade gradient top */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />

        {/* Scrollable content */}
        <div className="h-full overflow-y-auto scrollbar-hide space-y-3 pr-1 py-6">
          {Array.from({ length: cardCount }).map((_, i) => (
            <RoadmapCardSkeleton key={i} />
          ))}
        </div>

        {/* Fade gradient bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  );
}

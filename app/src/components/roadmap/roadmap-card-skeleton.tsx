import { Skeleton } from "~/components/ui/skeleton";

export function RoadmapCardSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-border bg-card space-y-3">
      {/* Title */}
      <Skeleton className="h-5 w-3/4" />

      {/* Description - 2 lines */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>

      {/* Footer - votes + button */}
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-7 w-16 rounded" />
      </div>
    </div>
  );
}

"use client";

import { RoadmapColumn } from "~/components/roadmap/roadmap-column";
import { RoadmapColumnSkeleton } from "~/components/roadmap/roadmap-column-skeleton";
import { type RoadmapStatus } from "~/lib/roadmap-data";
import { api } from "~/trpc/react";

const COLUMNS: RoadmapStatus[] = [
  "review",
  "planned",
  "in_progress",
  "launched",
];

// Quantidade de cards skeleton por coluna (aproxima o real)
const SKELETON_COUNTS: Record<RoadmapStatus, number> = {
  review: 2,
  planned: 3,
  in_progress: 2,
  launched: 2,
};

export default function RoadmapPage() {
  const { data: items, isLoading, error } = api.roadmap.list.useQuery();

  // Agrupar items por status
  const getItemsByStatus = (status: RoadmapStatus) => {
    if (!items) return [];
    return items.filter((item) => item.status === status);
  };

  return (
    <section className="flex flex-col h-full overflow-hidden">
      {/* Header - altura fixa, pt-24 para ficar abaixo da navbar */}
      <div className="flex-shrink-0 px-6 pt-24 pb-6">
        <div className="mx-auto max-w-7xl text-center">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">
            Roadmap
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mt-3 mb-2">
            Construindo junto
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            Vote nas features que você mais quer.
          </p>
        </div>
      </div>

      {/* Kanban Board - ocupa espaço restante */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="mx-auto h-full max-w-7xl">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-destructive">
                Erro ao carregar roadmap. Tente novamente.
              </p>
            </div>
          ) : (
            <div className="grid h-full grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {COLUMNS.map((status) =>
                isLoading ? (
                  <RoadmapColumnSkeleton
                    key={status}
                    status={status}
                    cardCount={SKELETON_COUNTS[status]}
                  />
                ) : (
                  <RoadmapColumn
                    key={status}
                    status={status}
                    items={getItemsByStatus(status)}
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

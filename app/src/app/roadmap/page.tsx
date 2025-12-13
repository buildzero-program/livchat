"use client";

import { RoadmapColumn } from "~/components/roadmap/roadmap-column";
import { type RoadmapStatus, getItemsByStatus } from "~/lib/roadmap-data";

const COLUMNS: RoadmapStatus[] = [
  "review",
  "planned",
  "in_progress",
  "launched",
];

export default function RoadmapPage() {
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
          <div className="grid h-full grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {COLUMNS.map((status) => (
              <RoadmapColumn
                key={status}
                status={status}
                items={getItemsByStatus(status)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

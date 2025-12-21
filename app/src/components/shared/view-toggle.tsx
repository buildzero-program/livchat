"use client";

import { LayoutList, LayoutGrid } from "lucide-react";
import { cn } from "~/lib/utils";

export type ViewMode = "list" | "cards";

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border bg-muted/50 p-1">
      <button
        type="button"
        onClick={() => view !== "list" && onViewChange("list")}
        className={cn(
          "flex items-center justify-center rounded-md p-1.5 transition-colors",
          view === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Visualização em lista"
      >
        <LayoutList className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => view !== "cards" && onViewChange("cards")}
        className={cn(
          "flex items-center justify-center rounded-md p-1.5 transition-colors",
          view === "cards"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Visualização em cards"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );
}

"use client";

import { MessageSquare, Image } from "lucide-react";
import { cn } from "~/lib/utils";

export type MessageType = "text" | "image";

const MESSAGE_TYPES = [
  { id: "text" as const, icon: MessageSquare, label: "Texto" },
  { id: "image" as const, icon: Image, label: "Imagem" },
];

interface TypeSelectorProps {
  value: MessageType;
  onChange: (type: MessageType) => void;
}

export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <div className="flex p-1 bg-muted/50 rounded-full">
      {MESSAGE_TYPES.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium transition-all",
            value === id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

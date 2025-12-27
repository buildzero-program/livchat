"use client";

import { Zap, Bot, Trash2, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface CanvasToolbarProps {
  onAddTrigger: () => void;
  onAddAgent: () => void;
  onClear: () => void;
  onReset: () => void;
}

export function CanvasToolbar({
  onAddTrigger,
  onAddAgent,
  onClear,
  onReset,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur-sm">
      {/* Add Trigger */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onAddTrigger}
          >
            <Zap className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Adicionar Trigger</p>
        </TooltipContent>
      </Tooltip>

      {/* Add Agent */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onAddAgent}
          >
            <Bot className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Adicionar Agente</p>
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="mx-1 h-4 w-px bg-border" />

      {/* Clear */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Limpar Canvas</p>
        </TooltipContent>
      </Tooltip>

      {/* Reset */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onReset}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Resetar para Inicial</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

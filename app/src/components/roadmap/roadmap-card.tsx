"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { type RoadmapItem } from "~/lib/roadmap-data";
import { cn } from "~/lib/utils";

interface RoadmapCardProps {
  item: RoadmapItem;
}

export function RoadmapCard({ item }: RoadmapCardProps) {
  const [votes, setVotes] = useState(item.votes);
  const [hasVoted, setHasVoted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingBack, setIsAnimatingBack] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);

  // Hydration-safe: read localStorage after mount
  useEffect(() => {
    const voted = localStorage.getItem(`roadmap-vote-${item.id}`);
    if (voted === "true") {
      setHasVoted(true);
    }
  }, [item.id]);

  const handleVote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVoted) {
      setVotes((v) => v - 1);
      setHasVoted(false);
      localStorage.removeItem(`roadmap-vote-${item.id}`);
    } else {
      setVotes((v) => v + 1);
      setHasVoted(true);
      localStorage.setItem(`roadmap-vote-${item.id}`, "true");
    }
  };

  // Pointer events para drag manual
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;

    e.currentTarget.setPointerCapture(e.pointerId);

    if (cardRef.current) {
      setCardRect(cardRef.current.getBoundingClientRect());
    }

    setStartPosition({ x: e.clientX, y: e.clientY });
    setDragPosition({ x: 0, y: 0 });
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startPosition.x;
    const deltaY = e.clientY - startPosition.y;
    setDragPosition({ x: deltaX, y: deltaY });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    // Inicia animação de snap-back
    setIsDragging(false);
    setIsAnimatingBack(true);
  };

  const isLaunched = item.status === "launched";
  const showPortal = isDragging || isAnimatingBack;

  const cardContent = (
    <>
      <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
      <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
        {item.description}
      </p>
      <div className="flex items-center justify-between">
        {isLaunched ? (
          <>
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-xs font-mono bg-green-500/10 text-green-500 border border-green-500/20"
            >
              {item.version}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {votes} votos
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              {votes} votos
            </span>
            <Button
              variant={hasVoted ? "default" : "outline"}
              size="sm"
              onClick={handleVote}
              className={cn(
                "h-7 px-2 text-xs gap-1",
                hasVoted && "bg-primary text-primary-foreground"
              )}
            >
              <ChevronUp className="h-3 w-3" />
              {hasVoted ? "Votado" : "Votar"}
            </Button>
          </>
        )}
      </div>
    </>
  );

  // Portal do card - fica visível durante drag E durante animação de volta
  const draggedCard =
    showPortal && cardRect && typeof document !== "undefined"
      ? createPortal(
          <motion.div
            className="p-4 rounded-lg border border-primary/50 bg-card fixed pointer-events-none"
            initial={false}
            animate={{
              scale: isDragging ? 1.05 : 1,
              rotate: isDragging ? 2 : 0,
              x: isDragging ? dragPosition.x : 0,
              y: isDragging ? dragPosition.y : 0,
            }}
            transition={{
              type: "spring",
              stiffness: isDragging ? 500 : 180,
              damping: isDragging ? 30 : 15,
              bounce: 0.4,
            }}
            onAnimationComplete={() => {
              // Remove portal após animação de snap-back completar
              if (isAnimatingBack) {
                setIsAnimatingBack(false);
                setDragPosition({ x: 0, y: 0 });
              }
            }}
            style={{
              left: cardRect.left,
              top: cardRect.top,
              width: cardRect.width,
              boxShadow: isDragging
                ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                : "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
              zIndex: 9999,
            }}
          >
            {cardContent}
          </motion.div>,
          document.body
        )
      : null;

  return (
    <>
      {/* Card original - vira ghost quando arrastando */}
      <div
        ref={cardRef}
        className={cn(
          "p-4 rounded-lg border border-border bg-card transition-all select-none touch-none",
          showPortal
            ? "opacity-40 border-dashed"
            : "hover:border-primary/30 cursor-grab active:cursor-grabbing"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {cardContent}
      </div>

      {/* Card arrastado via portal - livre na tela toda */}
      {draggedCard}
    </>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface RoadmapCardItem {
  id: string;
  title: string;
  description: string;
  status: "review" | "planned" | "in_progress" | "launched";
  votes: number;
  hasVoted: boolean;
  version?: string;
}

interface RoadmapCardProps {
  item: RoadmapCardItem;
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function RoadmapCard({ item }: RoadmapCardProps) {
  // ═══════════════════════════════════════════════════════════════════════════
  // Local state para UI instantânea (desacoplado do servidor)
  // ═══════════════════════════════════════════════════════════════════════════
  const [localVoted, setLocalVoted] = useState(item.hasVoted);
  const [localVotes, setLocalVotes] = useState(item.votes);

  // Refs para debounce e tracking
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const desiredStateRef = useRef(item.hasVoted);
  const syncedStateRef = useRef(item.hasVoted);
  const baseVotesRef = useRef(item.votes);

  // Sync com props quando mudam (ex: refetch do servidor)
  useEffect(() => {
    // Só sincroniza se não houver operação pendente
    if (!debounceTimerRef.current) {
      setLocalVoted(item.hasVoted);
      setLocalVotes(item.votes);
      desiredStateRef.current = item.hasVoted;
      syncedStateRef.current = item.hasVoted;
      baseVotesRef.current = item.votes;
    }
  }, [item.hasVoted, item.votes]);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingBack, setIsAnimatingBack] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // tRPC mutations (fire-and-forget com debounce)
  // ═══════════════════════════════════════════════════════════════════════════
  const utils = api.useUtils();

  const voteMutation = api.roadmap.vote.useMutation({
    onSuccess: () => {
      syncedStateRef.current = true;
      void utils.roadmap.list.invalidate();
    },
    onError: () => {
      // Rollback em caso de erro
      setLocalVoted(syncedStateRef.current);
      const voteDiff = syncedStateRef.current ? 1 : 0;
      setLocalVotes(baseVotesRef.current + voteDiff);
    },
  });

  const unvoteMutation = api.roadmap.unvote.useMutation({
    onSuccess: () => {
      syncedStateRef.current = false;
      void utils.roadmap.list.invalidate();
    },
    onError: () => {
      // Rollback em caso de erro
      setLocalVoted(syncedStateRef.current);
      const voteDiff = syncedStateRef.current ? 1 : 0;
      setLocalVotes(baseVotesRef.current + voteDiff);
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Handle vote com debounce (permite spam clicking)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleVote = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      // Toggle estado desejado
      const newVoted = !desiredStateRef.current;
      desiredStateRef.current = newVoted;

      // Atualiza UI IMEDIATAMENTE
      setLocalVoted(newVoted);

      // Calcula nova contagem baseado no estado atual
      if (newVoted && !syncedStateRef.current) {
        // Estava não votado, agora votou -> +1
        setLocalVotes(baseVotesRef.current + 1);
      } else if (!newVoted && syncedStateRef.current) {
        // Estava votado, agora desvotou -> volta ao base
        setLocalVotes(baseVotesRef.current);
      } else if (newVoted && syncedStateRef.current) {
        // Já estava votado no server, mantém
        setLocalVotes(baseVotesRef.current + 1);
      } else {
        // Não estava votado, continua não votado
        setLocalVotes(baseVotesRef.current);
      }

      // Cancela timer anterior
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Agenda sync com servidor após debounce (500ms)
      debounceTimerRef.current = setTimeout(() => {
        const finalState = desiredStateRef.current;

        // Só envia se estado final diferir do sincronizado
        if (finalState !== syncedStateRef.current) {
          if (finalState) {
            voteMutation.mutate({ itemId: item.id });
          } else {
            unvoteMutation.mutate({ itemId: item.id });
          }
        }

        debounceTimerRef.current = null;
      }, 500);
    },
    [item.id, voteMutation, unvoteMutation]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Drag handlers
  // ═══════════════════════════════════════════════════════════════════════════

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
    setIsDragging(false);
    setIsAnimatingBack(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

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
              {localVotes} votos
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              {localVotes} votos
            </span>
            <Button
              variant={localVoted ? "default" : "outline"}
              size="sm"
              onClick={handleVote}
              className={cn(
                "h-7 px-2 text-xs gap-1 transition-all duration-150",
                localVoted && "bg-primary text-primary-foreground",
                "active:scale-95"
              )}
            >
              <ChevronUp
                className={cn(
                  "h-3 w-3 transition-transform duration-150",
                  localVoted && "scale-110"
                )}
              />
              {localVoted ? "Votado" : "Votar"}
            </Button>
          </>
        )}
      </div>
    </>
  );

  // Portal do card sendo arrastado
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

      {/* Card arrastado via portal */}
      {draggedCard}
    </>
  );
}

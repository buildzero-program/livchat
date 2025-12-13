"use client";

import { useState } from "react";
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
  const [hasVoted, setHasVoted] = useState(() => {
    if (typeof window === "undefined") return false;
    const voted = localStorage.getItem(`roadmap-vote-${item.id}`);
    return voted === "true";
  });

  const handleVote = () => {
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

  const isLaunched = item.status === "launched";

  return (
    <motion.div
      className="p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors cursor-grab active:cursor-grabbing"
      drag
      dragSnapToOrigin
      dragElastic={0.15}
      dragTransition={{
        bounceStiffness: 500,
        bounceDamping: 20,
      }}
      whileDrag={{
        scale: 1.05,
        rotate: 2,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        zIndex: 9999,
        cursor: "grabbing",
      }}
      whileTap={{
        scale: 1.02,
      }}
    >
      {/* Title */}
      <h3 className="font-semibold text-sm mb-2">{item.title}</h3>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
        {item.description}
      </p>

      {/* Footer */}
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
    </motion.div>
  );
}

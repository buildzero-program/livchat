"use client";

import { motion } from "framer-motion";
import { TrendingUp, Zap, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { mockMonthUsage } from "~/lib/mock-dashboard";

const planLabels = {
  free: "Free",
  starter: "Starter",
  scale: "Scale",
} as const;

export function QuotaWidget() {
  const usage = mockMonthUsage;

  const isNearLimit = usage.percentage >= 80;
  const isAtLimit = usage.percentage >= 100;

  return (
    <Card
      className={`relative overflow-hidden transition-colors ${
        isAtLimit
          ? "border-red-500/50"
          : isNearLimit
            ? "border-yellow-500/30"
            : ""
      }`}
    >
      {/* Warning gradient */}
      {isNearLimit && !isAtLimit && (
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
      )}
      {isAtLimit && (
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
      )}

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Uso do Mês
        </CardTitle>
        <Badge variant="secondary" className="text-xs">
          {planLabels[usage.plan]}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Usage numbers */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <motion.span
              className="text-2xl font-bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {usage.used.toLocaleString("pt-BR")}
            </motion.span>
            <span className="text-sm text-muted-foreground">
              de {usage.limit.toLocaleString("pt-BR")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">mensagens</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress
            value={Math.min(usage.percentage, 100)}
            className={`h-2 ${
              isAtLimit
                ? "[&>div]:bg-red-500"
                : isNearLimit
                  ? "[&>div]:bg-yellow-500"
                  : "[&>div]:bg-primary"
            }`}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{usage.percentage}% utilizado</span>
            <span>{usage.daysRemaining} dias restantes</span>
          </div>
        </div>

        {/* Warning or upgrade */}
        {isAtLimit ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-500 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Limite atingido</span>
          </div>
        ) : isNearLimit ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 text-yellow-500 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Próximo do limite</span>
          </div>
        ) : null}

        {/* Upgrade button */}
        {usage.plan !== "scale" && (
          <Button
            variant={isNearLimit ? "default" : "outline"}
            size="sm"
            className="w-full"
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Fazer Upgrade
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import { mockMetricsToday, mockWeekData } from "~/lib/mock-dashboard";

const chartConfig = {
  sent: {
    label: "Enviadas",
    color: "var(--chart-1)", // Purple
  },
  received: {
    label: "Recebidas",
    color: "var(--chart-2)", // Lighter purple
  },
} satisfies ChartConfig;

// Animated number component
function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {value.toLocaleString("pt-BR")}
    </motion.span>
  );
}

export function MetricsWidget() {
  const metrics = mockMetricsToday;
  const chartData = mockWeekData;

  const isPositive = metrics.comparison.trend === "up";

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Atividade Hoje</CardTitle>
        <div
          className={`flex items-center gap-1 text-xs ${
            isPositive ? "text-green-500" : "text-red-500"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          <span>{metrics.comparison.percentage}%</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main metric */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">
            <AnimatedNumber value={metrics.totalMessages} />
          </span>
          <span className="text-muted-foreground">mensagens</span>
        </div>

        {/* Sent/Received breakdown */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5 text-chart-1" />
            <span className="text-muted-foreground">
              {metrics.messagesSent} enviadas
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowDownLeft className="h-3.5 w-3.5 text-chart-2" />
            <span className="text-muted-foreground">
              {metrics.messagesReceived} recebidas
            </span>
          </div>
        </div>

        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-[120px] w-full">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillReceived" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={10}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <YAxis hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              type="monotone"
              dataKey="received"
              stroke="var(--chart-2)"
              strokeWidth={2}
              fill="url(#fillReceived)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="sent"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#fillSent)"
              stackId="1"
            />
          </AreaChart>
        </ChartContainer>

        <p className="text-xs text-muted-foreground text-center">
          Últimos 7 dias
        </p>
      </CardContent>
    </Card>
  );
}

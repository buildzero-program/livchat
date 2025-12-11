"use client";

import { useEffect, useState } from "react";
import { useAnimatedCounter } from "~/hooks/use-animated-counter";

// ═══════════════════════════════════════════════════════════════════════════
// LiveCounter Component
// Real-time message counter for the landing page
// Fetches from /api/stats/counter and interpolates between refreshes
// ═══════════════════════════════════════════════════════════════════════════

interface CounterData {
  baseValue: number;
  ratePerSecond: number;
  calculatedAt: number;
}

export function LiveCounter() {
  const [data, setData] = useState<CounterData | null>(null);
  const [interpolatedTarget, setInterpolatedTarget] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Animated value with smooth easing (500ms animation)
  const displayValue = useAnimatedCounter(interpolatedTarget, 500);

  // Fetch stats from backend every 5 minutes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/stats/counter");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = (await res.json()) as CounterData;
        setData(json);
        setIsLoading(false);
      } catch (error) {
        console.error("[LiveCounter] Failed to fetch:", error);
        // Keep showing last known value on error
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Interpolate value every second based on rate
  useEffect(() => {
    if (!data) return;

    const tick = () => {
      const elapsed = (Date.now() - data.calculatedAt) / 1000;
      const interpolated = Math.floor(
        data.baseValue + elapsed * data.ratePerSecond
      );
      setInterpolatedTarget(interpolated);
    };

    tick(); // Initial tick
    const interval = setInterval(tick, 1000); // Update every second
    return () => clearInterval(interval);
  }, [data]);

  // Format number with Brazilian locale (1.234.567)
  const formattedValue = displayValue.toLocaleString("pt-BR");

  return (
    <div className="text-center">
      <div
        className={`text-5xl md:text-6xl font-bold text-primary tabular-nums transition-opacity duration-300 ${
          isLoading ? "opacity-50" : "opacity-100"
        }`}
      >
        {formattedValue}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Mensagens transacionadas
      </p>
    </div>
  );
}

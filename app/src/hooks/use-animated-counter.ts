"use client";

import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useAnimatedCounter Hook
// Animates a number from current value to target with smooth easing
// Zero dependencies - uses requestAnimationFrame
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Easing function: easeOutQuart
 * Fast start, slow end - feels natural for counters
 * Formula: 1 - (1 - x)^4
 */
function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

/**
 * Hook to animate a counter from current value to target
 *
 * @param target - The target value to animate towards
 * @param duration - Animation duration in ms (default: 1000)
 * @returns Current animated value
 *
 * @example
 * const count = useAnimatedCounter(1000, 500);
 * // Animates from 0 to 1000 over 500ms with easing
 */
export function useAnimatedCounter(target: number, duration = 1000): number {
  const [value, setValue] = useState(0);
  const previousTarget = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const start = previousTarget.current;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      const current = Math.floor(start + (target - start) * easedProgress);
      setValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousTarget.current = target;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [target, duration]);

  return value;
}

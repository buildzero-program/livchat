import { NextResponse } from "next/server";
import { getGlobalStats } from "~/server/lib/events";

// ═══════════════════════════════════════════════════════════════════════════
// Stats Counter API
// Returns message statistics for the landing page counter
// ═══════════════════════════════════════════════════════════════════════════

interface CounterResponse {
  baseValue: number;
  ratePerSecond: number;
  calculatedAt: number;
}

// In-memory cache (5 minutes TTL)
let cache: { data: CounterResponse; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/stats/counter
 *
 * Returns:
 * - baseValue: Total messages processed
 * - ratePerSecond: Current throughput rate
 * - calculatedAt: Timestamp for client interpolation
 *
 * Cached for 5 minutes to reduce database load
 */
export async function GET() {
  try {
    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: {
          "Cache-Control": "public, max-age=300", // 5 min browser cache
        },
      });
    }

    // Fetch fresh data
    const stats = await getGlobalStats();

    const response: CounterResponse = {
      baseValue: stats.totalMessages,
      ratePerSecond: stats.ratePerSecond,
      calculatedAt: Date.now(),
    };

    // Update cache
    cache = { data: response, timestamp: Date.now() };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("[stats/counter] Error fetching stats:", error);

    // Return fallback data on error
    return NextResponse.json(
      {
        baseValue: 0,
        ratePerSecond: 0,
        calculatedAt: Date.now(),
      },
      { status: 200 } // Still 200 to not break the UI
    );
  }
}

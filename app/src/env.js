import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // WuzAPI
    WUZAPI_URL: z.string().url().default("http://localhost:8080"),
    WUZAPI_INTERNAL_TOKEN: z.string().min(1).optional(),
    WUZAPI_ADMIN_TOKEN: z.string().min(1).optional(),
    // WuzAPI Webhook HMAC validation (same as WUZAPI_GLOBAL_HMAC_KEY on Fly.io)
    WUZAPI_WEBHOOK_SECRET: z.string().min(32).optional(),
    // Internal API (Cloudflare Worker <-> Vercel)
    INTERNAL_SECRET: z.string().min(32).optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // API URL override (optional, auto-detects if not set)
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    // WuzAPI
    WUZAPI_URL: process.env.WUZAPI_URL,
    WUZAPI_INTERNAL_TOKEN: process.env.WUZAPI_INTERNAL_TOKEN,
    WUZAPI_ADMIN_TOKEN: process.env.WUZAPI_ADMIN_TOKEN,
    WUZAPI_WEBHOOK_SECRET: process.env.WUZAPI_WEBHOOK_SECRET,
    // Internal API
    INTERNAL_SECRET: process.env.INTERNAL_SECRET,
    // Client-side
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

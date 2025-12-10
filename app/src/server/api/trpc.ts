/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

import { db } from "~/server/db";
import { getOrCreateDevice, type DeviceInfo } from "~/server/lib/device";
import { syncUserFromClerk, type SyncedUser } from "~/server/lib/user";
import { DEVICE_COOKIE_NAME, DEVICE_COOKIE_MAX_AGE } from "~/lib/constants";
import { logger, LogActions, type Logger } from "~/server/lib/logger";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(DEVICE_COOKIE_NAME)?.value;

  // Extrair IP e User-Agent
  const ipAddress =
    opts.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    opts.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = opts.headers.get("user-agent") ?? undefined;

  // Buscar ou criar device
  let device: DeviceInfo | null = null;
  try {
    device = await getOrCreateDevice(existingToken, ipAddress, userAgent);

    // Se novo device, setar cookie
    if (device.isNew) {
      cookieStore.set(DEVICE_COOKIE_NAME, device.token, {
        path: "/",
        maxAge: DEVICE_COOKIE_MAX_AGE,
        sameSite: "lax",
        httpOnly: false, // Precisa ser acessível no client
      });
    }
  } catch (error) {
    logger.error(LogActions.DEVICE_CREATE, "Error creating device", error);
    // Não bloquear request se device falhar
  }

  // Create request-scoped logger with device context
  const log: Logger = device
    ? logger.withContext({ deviceId: device.id })
    : logger;

  return {
    db,
    device,
    log,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
// Endpoints that are called frequently (polling) - use debug level
const POLLING_ENDPOINTS = new Set([
  "whatsapp.status",
  "whatsapp.list",
]);

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  const duration = end - start;

  // Use debug level for polling endpoints, info for others
  if (POLLING_ENDPOINTS.has(path)) {
    logger.debug(LogActions.TRPC_REQUEST, `${path} (${duration}ms)`, { path, duration });
  } else {
    logger.info(LogActions.TRPC_REQUEST, "Request completed", { path, duration });
  }

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Auth middleware
 *
 * Validates Clerk auth and syncs user to our database (on-demand).
 * Also claims any instances from the device to the user's organization.
 */
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Sync user on-demand (cria se não existe, claim instances do device)
  let user: SyncedUser;
  try {
    user = await syncUserFromClerk(clerkUserId, ctx.device?.id);
  } catch (error) {
    logger.error(LogActions.AUTH_ERROR, "Failed to sync user", error, {
      clerkUserId,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to sync user account",
    });
  }

  // Enhance logger with user context
  const log = ctx.log.withContext({
    userId: user.id,
    organizationId: user.organizationId,
  });

  return next({
    ctx: {
      ...ctx,
      user,
      clerkUserId,
      log,
    },
  });
});

/**
 * Protected (authenticated) procedure
 *
 * Requires Clerk authentication and syncs user to our database.
 * Use this for any routes that require a logged-in user.
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware);

/**
 * Optional auth middleware
 *
 * Tries to authenticate but doesn't fail if user is not logged in.
 * Used for hybrid endpoints that work for both anonymous and authenticated users.
 */
const optionalAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const { userId: clerkUserId } = await auth();

  // DEBUG: Log do estado do Clerk
  logger.info("hybrid.auth", "Optional auth check", {
    hasClerkUserId: !!clerkUserId,
    clerkUserId: clerkUserId?.slice(0, 8),
  });

  // Não autenticado - continua sem user
  if (!clerkUserId) {
    logger.info("hybrid.auth", "No Clerk user, continuing anonymous");
    return next({
      ctx: {
        ...ctx,
        user: undefined as SyncedUser | undefined,
        clerkUserId: undefined as string | undefined,
      },
    });
  }

  // Autenticado - sync user on-demand
  try {
    logger.info("hybrid.auth", "Clerk user found, syncing", { clerkUserId: clerkUserId.slice(0, 8) });

    const user = await syncUserFromClerk(clerkUserId, ctx.device?.id);

    logger.info("hybrid.auth", "User synced successfully", {
      userId: user.id,
      organizationId: user.organizationId,
    });

    // Enhance logger with user context
    const log = ctx.log.withContext({
      userId: user.id,
      organizationId: user.organizationId,
    });

    return next({
      ctx: {
        ...ctx,
        user: user as SyncedUser | undefined,
        clerkUserId: clerkUserId as string | undefined,
        log,
      },
    });
  } catch (error) {
    // Erro no sync - loga mas continua sem user (não bloqueia)
    logger.warn(LogActions.AUTH_ERROR, "Failed to sync user in hybrid procedure", {
      clerkUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    return next({
      ctx: {
        ...ctx,
        user: undefined as SyncedUser | undefined,
        clerkUserId: undefined as string | undefined,
      },
    });
  }
});

/**
 * Hybrid procedure (optional auth)
 *
 * Works for both anonymous and authenticated users.
 * If authenticated, ctx.user will be available.
 * If anonymous, ctx.user will be undefined.
 *
 * Use case: Landing page showing connected instance for logged-in users.
 */
export const hybridProcedure = t.procedure
  .use(timingMiddleware)
  .use(optionalAuthMiddleware);

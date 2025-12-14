import { whatsappRouter } from "~/server/api/routers/whatsapp";
import { apiKeysRouter } from "~/server/api/routers/apiKeys";
import { webhooksRouter } from "~/server/api/routers/webhooks";
import { roadmapRouter } from "~/server/api/routers/roadmap";
import { ivyRouter } from "~/server/api/routers/ivy";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  whatsapp: whatsappRouter,
  apiKeys: apiKeysRouter,
  webhooks: webhooksRouter,
  roadmap: roadmapRouter,
  ivy: ivyRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Rotas públicas que não requerem autenticação
 */
const isPublicRoute = createRouteMatcher([
  "/",                    // Landing page
  "/roadmap",             // Roadmap público
  "/changelog",           // Changelog público
  "/terms",               // Termos de uso
  "/sso-callback",        // OAuth callback
  "/api/health",          // Health check (Docker/K8s)
  "/api/trpc(.*)",        // tRPC API (tem própria autenticação)
  "/api/webhooks(.*)",    // Webhooks externos
  "/api/public(.*)",      // APIs públicas
  "/api/internal(.*)",    // APIs internas (Worker → Vercel)
  "/api/v1(.*)",          // REST API pública (autenticação própria via API key)
  "/api/stats(.*)",       // Stats públicas (contador)
]);

export default clerkMiddleware(async (auth, request) => {
  // Se NÃO for rota pública, protege e redireciona para "/" se não autenticado
  if (!isPublicRoute(request)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/", request.url).toString(),
    });
  }
});

export const config = {
  matcher: [
    // Pega todas as rotas exceto arquivos estáticos
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Sempre processa API e tRPC
    "/(api|trpc)(.*)",
  ],
};

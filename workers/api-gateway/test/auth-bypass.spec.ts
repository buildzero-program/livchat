import { describe, it, expect } from "bun:test";
import { requiresAuth, getRoute, type RouteConfig } from "../src/router";

describe("Auth Bypass Logic", () => {
  describe("requiresAuth", () => {
    describe("routes that should NOT require auth (bypass)", () => {
      it("should return false for /webhooks/wuzapi", () => {
        expect(requiresAuth("/webhooks/wuzapi")).toBe(false);
      });

      it("should return false for /webhooks/clerk", () => {
        expect(requiresAuth("/webhooks/clerk")).toBe(false);
      });

      it("should return false for /webhooks/abacate", () => {
        expect(requiresAuth("/webhooks/abacate")).toBe(false);
      });

      it("should return false for /health", () => {
        expect(requiresAuth("/health")).toBe(false);
      });

      it("should return false for root /", () => {
        expect(requiresAuth("/")).toBe(false);
      });
    });

    describe("routes that SHOULD require auth (bearer token)", () => {
      it("should return true for /v1/messages/send", () => {
        expect(requiresAuth("/v1/messages/send")).toBe(true);
      });

      it("should return true for /v1/session/status", () => {
        expect(requiresAuth("/v1/session/status")).toBe(true);
      });

      it("should return true for /v1/contacts/check", () => {
        expect(requiresAuth("/v1/contacts/check")).toBe(true);
      });

      it("should return true for /v1/groups/list", () => {
        expect(requiresAuth("/v1/groups/list")).toBe(true);
      });

      it("should return true for unknown routes", () => {
        expect(requiresAuth("/unknown/path")).toBe(true);
      });
    });

    describe("internal routes require X-Internal-Secret", () => {
      // Internal routes are still "requires auth" but different type
      it("should return true for /internal/validate-key (checked by route config)", () => {
        expect(requiresAuth("/internal/validate-key")).toBe(true);
      });
    });
  });

  describe("getRoute", () => {
    describe("webhook routes", () => {
      it("should return route config for /webhooks/wuzapi", () => {
        const route = getRoute("/webhooks/wuzapi");
        expect(route).not.toBeNull();
        expect(route?.backend).toBe("vercel");
        expect(route?.path).toBe("/api/webhooks/wuzapi");
        expect(route?.auth).toBe("bypass");
        expect(route?.methods).toContain("POST");
        expect(route?.methods).toContain("GET");
      });

      it("should return route config for /webhooks/clerk", () => {
        const route = getRoute("/webhooks/clerk");
        expect(route).not.toBeNull();
        expect(route?.backend).toBe("vercel");
        expect(route?.auth).toBe("bypass");
      });

      it("should return route config for /webhooks/abacate", () => {
        const route = getRoute("/webhooks/abacate");
        expect(route).not.toBeNull();
        expect(route?.backend).toBe("vercel");
        expect(route?.auth).toBe("bypass");
      });
    });

    describe("internal routes", () => {
      it("should return route config for /internal/validate-key", () => {
        const route = getRoute("/internal/validate-key");
        expect(route).not.toBeNull();
        expect(route?.backend).toBe("vercel");
        expect(route?.path).toBe("/api/internal/validate-key");
        expect(route?.auth).toBe("internal-secret");
      });
    });

    describe("v1 routes (authenticated)", () => {
      it("should return route config for /v1/messages/send", () => {
        const route = getRoute("/v1/messages/send");
        expect(route).not.toBeNull();
        expect(route?.backend).toBe("wuzapi");
        // v1 routes don't have explicit auth field (default is bearer)
        expect(route?.auth).toBeUndefined();
      });
    });

    describe("unknown routes", () => {
      it("should return null for unknown paths", () => {
        const route = getRoute("/unknown/path");
        expect(route).toBeNull();
      });
    });
  });

  describe("RouteConfig auth types", () => {
    it("webhook routes should have skipTransform: true", () => {
      const wuzapiRoute = getRoute("/webhooks/wuzapi");
      expect(wuzapiRoute?.skipTransform).toBe(true);
    });

    it("internal routes should have skipTransform: true", () => {
      const internalRoute = getRoute("/internal/validate-key");
      expect(internalRoute?.skipTransform).toBe(true);
    });
  });
});

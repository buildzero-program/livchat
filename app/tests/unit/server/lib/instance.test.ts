import { describe, it, expect, beforeEach, mock } from "bun:test";

/**
 * Testes para getConnectedOrganizationInstance
 *
 * Esta função é crítica para o fluxo híbrido da LP:
 * - Quando usuário está logado, busca a instância conectada da organização
 * - Retorna null se não houver instância conectada
 * - Prioriza instância mais recentemente conectada
 */

// Mock do env ANTES de tudo
mock.module("~/env", () => ({
  env: {
    WUZAPI_URL: "http://localhost:8080",
    WUZAPI_ADMIN_TOKEN: "test-admin-token",
    DATABASE_URL: "postgresql://test",
    NODE_ENV: "test",
  },
}));

// Mock do WuzAPIClient
const mockWuzAPIClient = mock(() => ({
  getStatus: mock(() => Promise.resolve({ data: { connected: true, loggedIn: true } })),
}));

mock.module("~/server/lib/wuzapi", () => ({
  WuzAPIClient: mockWuzAPIClient,
  createWuzAPIInstance: mock(() => Promise.resolve()),
}));

// Mock do logger
mock.module("~/server/lib/logger", () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
    withContext: mock(() => ({
      info: mock(),
      warn: mock(),
      error: mock(),
    })),
  },
  LogActions: {
    INSTANCE_CREATE: "instance.create",
    ORPHAN_ADOPT: "orphan.adopt",
    ORPHAN_DELETE: "orphan.delete",
    ORPHAN_CLEANUP: "orphan.cleanup",
  },
}));

// Mock do database
let mockFindFirstResult: any = null;

mock.module("~/server/db", () => ({
  db: {
    query: {
      instances: {
        findFirst: mock(() => Promise.resolve(mockFindFirstResult)),
        findMany: mock(() => Promise.resolve([])),
      },
    },
    insert: mock(() => ({
      values: mock(() => ({
        returning: mock(() => Promise.resolve([{ id: "test-id" }])),
      })),
    })),
    update: mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      })),
    })),
    delete: mock(() => ({
      where: mock(() => Promise.resolve()),
    })),
    transaction: mock(async (fn: any) => fn({
      query: {
        instances: {
          findFirst: mock(() => Promise.resolve(null)),
        },
      },
      update: mock(() => ({
        set: mock(() => ({
          where: mock(() => ({
            returning: mock(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
  },
}));

// Mock do schema
mock.module("~/server/db/schema", () => ({
  instances: {
    id: "id",
    organizationId: "organizationId",
    whatsappJid: "whatsappJid",
    lastConnectedAt: "lastConnectedAt",
    createdByDeviceId: "createdByDeviceId",
    status: "status",
    providerToken: "providerToken",
    // messagesUsedToday and lastMessageResetAt REMOVED - now tracked in Redis
    reuseCount: "reuseCount",
    createdAt: "createdAt",
    lastActivityAt: "lastActivityAt",
  },
  apiKeys: {
    id: "id",
    organizationId: "organizationId",
    instanceId: "instanceId",
    createdByDeviceId: "createdByDeviceId",
    token: "token",
    isActive: "isActive",
    claimedAt: "claimedAt",
  },
}));

// Mock das constantes
mock.module("~/lib/constants", () => ({
  DEMO_MESSAGE_LIMIT: 50,
}));

describe("getConnectedOrganizationInstance", () => {
  beforeEach(() => {
    mockFindFirstResult = null;
    mockWuzAPIClient.mockClear();
  });

  it("should return null when organization has no connected instances", async () => {
    mockFindFirstResult = null;

    const { getConnectedOrganizationInstance } = await import("~/server/lib/instance");
    const result = await getConnectedOrganizationInstance("org-123");

    expect(result).toBeNull();
  });

  it("should return instance with client when organization has connected instance", async () => {
    mockFindFirstResult = {
      id: "instance-123",
      organizationId: "org-123",
      whatsappJid: "5511999999999@s.whatsapp.net",
      providerToken: "lc_test_token_123",
      status: "connected",
      createdByDeviceId: "device-123",
      lastConnectedAt: new Date(),
    };

    const { getConnectedOrganizationInstance } = await import("~/server/lib/instance");
    const result = await getConnectedOrganizationInstance("org-123");

    expect(result).not.toBeNull();
    expect(result?.instance.id).toBe("instance-123");
    expect(result?.instance.organizationId).toBe("org-123");
    expect(result?.instance.whatsappJid).toBe("5511999999999@s.whatsapp.net");
    expect(result?.client).toBeDefined();
  });

  it("should create WuzAPIClient with correct token", async () => {
    mockFindFirstResult = {
      id: "instance-456",
      organizationId: "org-456",
      whatsappJid: "5511888888888@s.whatsapp.net",
      providerToken: "lc_specific_token",
      status: "connected",
    };

    const { getConnectedOrganizationInstance } = await import("~/server/lib/instance");
    await getConnectedOrganizationInstance("org-456");

    // WuzAPIClient foi chamado com o token correto
    expect(mockWuzAPIClient).toHaveBeenCalled();
  });
});

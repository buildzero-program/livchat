import { db } from "~/server/db";
import { devices } from "~/server/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { DEVICE_COOKIE_MAX_AGE } from "~/lib/constants";

export interface DeviceInfo {
  id: string;
  token: string;
  isNew: boolean;
}

/**
 * Busca device pelo token ou cria novo
 */
export async function getOrCreateDevice(
  token: string | undefined,
  ipAddress: string,
  userAgent: string | undefined
): Promise<DeviceInfo> {
  // Se tem token, tenta encontrar device válido (não expirado)
  if (token) {
    const existing = await db.query.devices.findFirst({
      where: and(eq(devices.token, token), gt(devices.expiresAt, new Date())),
    });

    if (existing) {
      // Atualiza lastSeenAt
      await db
        .update(devices)
        .set({ lastSeenAt: new Date() })
        .where(eq(devices.id, existing.id));

      return {
        id: existing.id,
        token: existing.token,
        isNew: false,
      };
    }
  }

  // Criar novo device
  const newToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + DEVICE_COOKIE_MAX_AGE);

  const [newDevice] = await db
    .insert(devices)
    .values({
      token: newToken,
      ipAddress,
      userAgent,
      expiresAt,
    })
    .returning();

  if (!newDevice) {
    throw new Error("Failed to create device");
  }

  return {
    id: newDevice.id,
    token: newDevice.token,
    isNew: true,
  };
}

/**
 * Busca device pelo token
 */
export async function getDeviceByToken(token: string) {
  return db.query.devices.findFirst({
    where: and(eq(devices.token, token), gt(devices.expiresAt, new Date())),
  });
}

/**
 * Busca device pelo ID
 */
export async function getDeviceById(id: string) {
  return db.query.devices.findFirst({
    where: eq(devices.id, id),
  });
}

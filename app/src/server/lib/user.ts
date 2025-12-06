import { db } from "~/server/db";
import { users, organizations } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { claimDeviceInstances } from "./instance";
import { clerkClient } from "@clerk/nextjs/server";
import { logger, LogActions } from "./logger";

export interface SyncedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  organizationId: string;
}

/**
 * Sync user do Clerk para nosso banco (on-demand)
 * Cria user + org se não existe
 * Claim instances do device se fornecido
 */
export async function syncUserFromClerk(
  clerkUserId: string,
  deviceId?: string
): Promise<SyncedUser> {
  // Buscar dados do Clerk
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(clerkUserId);

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("User sem email no Clerk");
  }

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
  const avatarUrl = clerkUser.imageUrl || null;

  // Buscar user existente
  let user = await db.query.users.findFirst({
    where: eq(users.externalId, clerkUserId),
  });

  let organization = user
    ? await db.query.organizations.findFirst({
        where: eq(organizations.ownerId, user.id),
      })
    : null;

  if (!user) {
    // Criar user + org em transaction
    const result = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          externalId: clerkUserId,
          externalProvider: "clerk",
          email,
          name,
          avatarUrl,
        })
        .returning();

      if (!newUser) throw new Error("Failed to create user");

      const orgName = name || email.split("@")[0] || "Minha Organização";

      const [newOrg] = await tx
        .insert(organizations)
        .values({
          ownerId: newUser.id,
          name: `Organização de ${orgName}`,
          plan: "free",
          maxInstances: 1,
          maxMessagesPerDay: 50,
        })
        .returning();

      if (!newOrg) throw new Error("Failed to create organization");

      return { user: newUser, organization: newOrg };
    });

    user = result.user;
    organization = result.organization;

    logger.info(LogActions.USER_CREATE, "New user created", {
      userId: user.id,
      organizationId: organization.id,
      email: user.email,
    });

    // Claim instances do device (se fornecido)
    if (deviceId && organization) {
      const claimed = await claimDeviceInstances(deviceId, organization.id);
      if (claimed > 0) {
        logger.info(LogActions.USER_CLAIM, "Instances claimed for new user", {
          userId: user.id,
          count: claimed,
          organizationId: organization.id,
        });
      }
    }
  } else {
    // User existe, verificar se precisa sync
    const needsSync =
      user.email !== email ||
      user.name !== name ||
      user.avatarUrl !== avatarUrl;

    if (needsSync) {
      const [updatedUser] = await db
        .update(users)
        .set({
          email,
          name,
          avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();

      if (updatedUser) {
        user = updatedUser;
        logger.info(LogActions.USER_SYNC, "User synced from Clerk", {
          userId: user.id,
        });
      }
    }

    // Tentar claim instances (caso tenha instance órfã do device)
    if (deviceId && organization) {
      const claimed = await claimDeviceInstances(deviceId, organization.id);
      if (claimed > 0) {
        logger.info(LogActions.USER_CLAIM, "Instances claimed for existing user", {
          userId: user.id,
          count: claimed,
          organizationId: organization.id,
        });
      }
    }
  }

  if (!organization) {
    throw new Error("User without organization");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    organizationId: organization.id,
  };
}

/**
 * Busca user por ID interno
 */
export async function getUserById(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

/**
 * Busca user por external ID (Clerk ID)
 */
export async function getUserByExternalId(externalId: string) {
  return db.query.users.findFirst({
    where: eq(users.externalId, externalId),
  });
}

/**
 * Busca organization do user
 */
export async function getUserOrganization(userId: string) {
  return db.query.organizations.findFirst({
    where: eq(organizations.ownerId, userId),
  });
}

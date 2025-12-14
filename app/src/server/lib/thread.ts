/**
 * Thread Service
 * Gerencia threads (conversas com workflows) no banco de dados
 */

import { db } from "~/server/db";
import { threads, workflows } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export interface ThreadData {
  id: string;
  workflowId: string;
  organizationId: string | null;
  userId: string | null;
  deviceId: string | null;
  providerThreadId: string;
  title: string | null;
  messageCount: number;
  status: string;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateThreadParams {
  workflowId: string;
  organizationId?: string;
  userId?: string;
  deviceId?: string;
  title?: string;
}

export interface ThreadWithWorkflow extends ThreadData {
  workflow: {
    id: string;
    providerId: string;
    name: string;
    description: string | null;
  };
}

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Gera um provider thread ID (UUID para o AST)
 */
export function generateProviderThreadId(): string {
  return randomUUID();
}

// =============================================================================
// DB FUNCTIONS
// =============================================================================

/**
 * Cria um novo thread
 */
export async function createThread(
  params: CreateThreadParams
): Promise<ThreadData> {
  const providerThreadId = generateProviderThreadId();

  const [result] = await db
    .insert(threads)
    .values({
      workflowId: params.workflowId,
      organizationId: params.organizationId ?? null,
      userId: params.userId ?? null,
      deviceId: params.deviceId ?? null,
      providerThreadId,
      title: params.title ?? null,
      messageCount: 0,
      status: "active",
    })
    .returning();

  if (!result) {
    throw new Error("Failed to create thread");
  }

  return result;
}

/**
 * Busca um thread pelo ID
 */
export async function getThread(threadId: string): Promise<ThreadData | null> {
  const result = await db.query.threads.findFirst({
    where: eq(threads.id, threadId),
  });

  return result ?? null;
}

/**
 * Busca um thread com o workflow associado
 */
export async function getThreadWithWorkflow(
  threadId: string
): Promise<ThreadWithWorkflow | null> {
  const result = await db.query.threads.findFirst({
    where: eq(threads.id, threadId),
    with: {
      workflow: {
        columns: {
          id: true,
          providerId: true,
          name: true,
          description: true,
        },
      },
    },
  });

  if (!result) return null;

  return {
    ...result,
    workflow: result.workflow,
  };
}

/**
 * Busca o thread ativo de um usuário para um workflow
 */
export async function getActiveThreadByUser(
  userId: string,
  workflowId: string
): Promise<ThreadData | null> {
  const result = await db.query.threads.findFirst({
    where: and(
      eq(threads.userId, userId),
      eq(threads.workflowId, workflowId),
      eq(threads.status, "active")
    ),
    orderBy: [desc(threads.updatedAt)],
  });

  return result ?? null;
}

/**
 * Busca o thread ativo de um device para um workflow
 */
export async function getActiveThreadByDevice(
  deviceId: string,
  workflowId: string
): Promise<ThreadData | null> {
  const result = await db.query.threads.findFirst({
    where: and(
      eq(threads.deviceId, deviceId),
      eq(threads.workflowId, workflowId),
      eq(threads.status, "active")
    ),
    orderBy: [desc(threads.updatedAt)],
  });

  return result ?? null;
}

/**
 * Lista threads de um usuário
 */
export async function listThreadsByUser(
  userId: string,
  options?: { status?: string; limit?: number }
): Promise<ThreadData[]> {
  const conditions = [eq(threads.userId, userId)];

  if (options?.status) {
    conditions.push(eq(threads.status, options.status));
  }

  return db.query.threads.findMany({
    where: and(...conditions),
    orderBy: [desc(threads.updatedAt)],
    limit: options?.limit ?? 50,
  });
}

/**
 * Lista threads de um device
 */
export async function listThreadsByDevice(
  deviceId: string,
  options?: { status?: string; limit?: number }
): Promise<ThreadData[]> {
  const conditions = [eq(threads.deviceId, deviceId)];

  if (options?.status) {
    conditions.push(eq(threads.status, options.status));
  }

  return db.query.threads.findMany({
    where: and(...conditions),
    orderBy: [desc(threads.updatedAt)],
    limit: options?.limit ?? 50,
  });
}

/**
 * Arquiva um thread (soft delete)
 */
export async function archiveThread(threadId: string): Promise<ThreadData> {
  const [result] = await db
    .update(threads)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(threads.id, threadId))
    .returning();

  if (!result) {
    throw new Error("Thread not found");
  }

  return result;
}

/**
 * Atualiza o contador de mensagens e lastMessageAt
 */
export async function incrementMessageCount(
  threadId: string
): Promise<ThreadData> {
  // Busca o thread atual
  const current = await getThread(threadId);
  if (!current) {
    throw new Error("Thread not found");
  }

  const [result] = await db
    .update(threads)
    .set({
      messageCount: current.messageCount + 1,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(threads.id, threadId))
    .returning();

  if (!result) {
    throw new Error("Failed to update thread");
  }

  return result;
}

/**
 * Atualiza o título do thread
 */
export async function updateThreadTitle(
  threadId: string,
  title: string
): Promise<ThreadData> {
  const [result] = await db
    .update(threads)
    .set({
      title,
      updatedAt: new Date(),
    })
    .where(eq(threads.id, threadId))
    .returning();

  if (!result) {
    throw new Error("Thread not found");
  }

  return result;
}

// =============================================================================
// WORKFLOW HELPERS
// =============================================================================

/**
 * Busca um workflow pelo providerId
 */
export async function getWorkflowByProviderId(providerId: string) {
  return db.query.workflows.findFirst({
    where: eq(workflows.providerId, providerId),
  });
}

/**
 * Busca o workflow da Ivy (sistema)
 */
export async function getIvyWorkflow() {
  return db.query.workflows.findFirst({
    where: and(
      eq(workflows.name, "Ivy"),
      eq(workflows.isActive, true)
    ),
  });
}

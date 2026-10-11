import type { DbOrTx } from "./db/client"
import { auditLogs } from "./db/schema"

export type Actor = { userId: string | null; label: string }

export const CUSTOMER_ACTOR: Actor = { userId: null, label: "Customer" }
export const SYSTEM_ACTOR: Actor = { userId: null, label: "System" }

export async function audit(
  db: DbOrTx,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  data?: Record<string, unknown>
) {
  await db.insert(auditLogs).values({
    actorUserId: actor.userId,
    action,
    entityType,
    entityId,
    data: { actor: actor.label, ...(data ?? {}) },
  })
}

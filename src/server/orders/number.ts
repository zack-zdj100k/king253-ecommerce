import { sql } from "drizzle-orm"

import type { Tx } from "../db/client"
import { orderCounters } from "../db/schema"

/** YYYYMMDD in Algeria's timezone, so numbers follow the shop's calendar day. */
export function algiersDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  return parts.replaceAll("-", "")
}

/**
 * KING253-20261004-001. The per-day counter row is locked by the upsert,
 * so numbers are unique and sequential even under concurrent checkouts.
 */
export async function nextOrderNumber(tx: Tx, prefix: string, date = new Date()) {
  const day = algiersDay(date)
  const [row] = await tx
    .insert(orderCounters)
    .values({ day, last: 1 })
    .onConflictDoUpdate({ target: orderCounters.day, set: { last: sql`${orderCounters.last} + 1` } })
    .returning({ last: orderCounters.last })
  return `${prefix}-${day}-${String(row.last).padStart(3, "0")}`
}

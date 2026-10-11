import { sql } from "drizzle-orm"

import type { DbOrTx } from "../db/client"
import { netRevenueSql } from "../pricing"
import { REFERRAL_SOURCES } from "@/lib/referral"

export type SourceRow = {
  key: string
  label: string
  accounts: number
  last30: number
  buyers: number
  orders: number
  revenue: number
}

/**
 * Where customers say they found KING 253 (sign-up question), with what those
 * accounts went on to buy. Revenue = clothes kept (same rule as the dashboard).
 */
export async function socialStats(db: DbOrTx) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const rows = (await db.execute(sql`
    select coalesce(u.referral_source, 'unknown') as key,
      count(*)::int as accounts,
      count(*) filter (where u.created_at >= ${since}::timestamptz)::int as last30,
      count(*) filter (where exists (select 1 from orders o where o.user_id = u.id and o.status <> 'cancelled'))::int as buyers,
      coalesce(sum((select count(*) from orders o where o.user_id = u.id and o.status <> 'cancelled')), 0)::int as orders,
      coalesce(sum((select sum(${netRevenueSql("o")}) from orders o where o.user_id = u.id and o.status = 'delivered')), 0)::int as revenue
    from users u
    where u.role = 'customer'
    group by 1
  `)) as unknown as Omit<SourceRow, "label">[]

  const known = REFERRAL_SOURCES.map((s) => {
    const r = rows.find((x) => x.key === s.key)
    return { key: s.key, label: s.label, accounts: r?.accounts ?? 0, last30: r?.last30 ?? 0, buyers: r?.buyers ?? 0, orders: r?.orders ?? 0, revenue: r?.revenue ?? 0 }
  }).sort((a, b) => b.accounts - a.accounts)
  const unknown = rows.find((x) => x.key === "unknown")
  const answered = known.reduce((n, s) => n + s.accounts, 0)
  return {
    sources: known,
    answered,
    /** Accounts created before the question existed (or by an admin). */
    notAsked: unknown?.accounts ?? 0,
    top: answered > 0 ? known[0] : null,
  }
}

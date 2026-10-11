import { sql } from "drizzle-orm"

import type { DbOrTx } from "../db/client"

/** Sidebar counters + demo-data warning, in one round trip. */
export async function adminBadges(db: DbOrTx, lowStockThreshold: number) {
  const [row] = (await db.execute(sql`
    select
      (select count(*)::int from orders where status in ('pending', 'contacting')) as new_orders,
      (select count(*)::int from reviews where status = 'pending') as pending_reviews,
      (select count(*)::int from return_requests where status in ('requested', 'approved', 'received')) as open_returns,
      (select count(*)::int from product_variants v join products p on p.id = v.product_id
        where v.active and p.status = 'published'
          and v.physical - v.reserved <= coalesce(v.low_stock_threshold, ${lowStockThreshold})) as low_stock,
      (select exists(select 1 from product_variants where sku like 'DEMO-%')) as has_demo
  `)) as unknown as { new_orders: number; pending_reviews: number; open_returns: number; low_stock: number; has_demo: boolean }[]
  return row
}

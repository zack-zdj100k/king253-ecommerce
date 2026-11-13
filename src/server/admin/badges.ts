import { sql } from "drizzle-orm"

import type { DbOrTx } from "../db/client"
import { ALERT_SS } from "../inventory"

/** Sidebar counters + demo-data warning, in one round trip. */
export async function adminBadges(db: DbOrTx, lowStockThreshold: number) {
  const [row] = (await db.execute(sql`
    select
      (select count(*)::int from orders where status = 'pending') as new_orders,
      (select count(*)::int from reviews where status = 'pending') as pending_reviews,
      0 as open_returns,
      (select count(*)::int from store_stock ss
        join stores s on s.id = ss.store_id and s.active
        join product_variants v on v.id = ss.variant_id
        join products p on p.id = v.product_id
        where v.active and p.status = 'published'
          and ss.physical - ss.reserved <= coalesce(v.low_stock_threshold, ${lowStockThreshold})
          and ${sql.raw(ALERT_SS)}) as low_stock,
      (select exists(select 1 from product_variants where sku like 'DEMO-%')) as has_demo
  `)) as unknown as { new_orders: number; pending_reviews: number; open_returns: number; low_stock: number; has_demo: boolean }[]
  return row
}

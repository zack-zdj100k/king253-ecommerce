import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { productStores, storeStock } from "@/server/db/schema"
import { adminBadges } from "@/server/admin/badges"
import { lowStockByShop } from "@/server/admin/queries"
import { adjustPhysicalStock } from "@/server/inventory"

import { resetDb, seedProduct, testDb, testShop } from "./support/db"

beforeEach(async () => {
  await resetDb()
})

const setCount = (variantId: string, storeId: number, n: number) =>
  testDb.transaction((tx) => adjustPhysicalStock(tx, { variantId, storeId, newPhysical: n, reason: "count", actorUserId: null as unknown as string }))

describe("Stock alerts count only real problems", () => {
  it("never-stocked sizes and shops that do not sell the product raise no alert; a sell-out does", async () => {
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 0 }, { size: "L", color: "Black", physical: 0 }] })
    const shop = tee.shop
    const other = await testShop("other-shop")
    await testDb.insert(productStores).values({ productId: tee.product.id, storeId: other.id })
    await testDb.insert(storeStock).values(tee.variants.map((v) => ({ variantId: v.id, storeId: other.id, physical: 0, reserved: 0 })))
    // Nothing was ever stocked → 0 alerts, even though every row is 0.
    expect((await adminBadges(testDb, 3)).low_stock).toBe(0)

    // Plenty of stock → still 0.
    await setCount(tee.variants[0].id, shop.id, 10)
    await setCount(tee.variants[1].id, shop.id, 10)
    expect((await adminBadges(testDb, 3)).low_stock).toBe(0)

    // M sells out in this shop → 1 real alert (the never-stocked other shop still does not count).
    await setCount(tee.variants[0].id, shop.id, 0)
    expect((await adminBadges(testDb, 3)).low_stock).toBe(1)
    const byShop = await lowStockByShop(testDb, 3)
    expect(byShop.find((s) => s.storeId === shop.id)).toMatchObject({ out: 1, low: 0 })
    expect(byShop.find((s) => s.storeId === other.id)).toBeUndefined()

    // The shop stops selling this product → no alert for it there.
    await testDb.update(productStores).set({ active: false }).where(eq(productStores.storeId, shop.id))
    expect((await adminBadges(testDb, 3)).low_stock).toBe(0)
  })
})

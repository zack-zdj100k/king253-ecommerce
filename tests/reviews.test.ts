import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { reviews } from "@/server/db/schema"
import { getProductPage } from "@/server/catalog"
import { approvedReviews, submitReview } from "@/server/reviews"

import { resetDb, seedProduct, testDb } from "./support/db"

beforeEach(async () => {
  await resetDb()
})

describe("Customer reviews", () => {
  it("are pending until approved, then show on the product page with the rating", async () => {
    const p = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 3 }] })
    const r = await submitReview(testDb, { productId: p.product.id, authorName: "Amine", rating: 5, body: "Great quality, fits perfectly." })
    expect(await approvedReviews(testDb, p.product.id)).toHaveLength(0)
    expect((await getProductPage(testDb, "tee"))!.rating.total).toBe(0)

    await testDb.update(reviews).set({ status: "approved" }).where(eq(reviews.id, r.id))
    expect((await approvedReviews(testDb, p.product.id)).map((x) => x.authorName)).toEqual(["Amine"])
    expect((await getProductPage(testDb, "tee"))!.rating).toMatchObject({ average: 5, total: 1 })
  })
})

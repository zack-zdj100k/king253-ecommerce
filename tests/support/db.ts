import { config } from "dotenv"
import { sql } from "drizzle-orm"

import { createDb } from "@/server/db/client"
import { categories, productImages, productVariants, products } from "@/server/db/schema"
import { saveSettings } from "@/server/settings"

config({ path: ".env.local" })

export const testDb = createDb(process.env.TEST_DATABASE_URL!, { max: 10 })

/** Wipe every table (test database only). */
export async function resetDb() {
  const rows = await testDb.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'`
  )
  const names = rows.map((r) => `"${r.tablename}"`).join(", ")
  if (names) await testDb.execute(sql.raw(`truncate ${names} restart identity cascade`))
}

/** Test fixtures — clearly fake values used only in the test database. */
export async function seedDelivery(fee = 500) {
  await saveSettings(testDb, { deliveryFee: fee, deliveryEstimate: "2–3 days" })
  return { wilaya: "Alger" }
}

export async function seedProduct(opts: {
  slug: string
  price: number
  variants: { size: string; color: string; physical: number; reserved?: number }[]
  status?: "draft" | "published"
}) {
  const [category] = await testDb
    .insert(categories)
    .values({ slug: `cat-${opts.slug}`, name: "Test" })
    .returning()
  const [product] = await testDb
    .insert(products)
    .values({ slug: opts.slug, name: `Product ${opts.slug}`, categoryId: category.id, price: opts.price, status: opts.status ?? "published" })
    .returning()
  await testDb.insert(productImages).values({ productId: product.id, url: "/test.jpg", isMain: true })
  const variants = await testDb
    .insert(productVariants)
    .values(
      opts.variants.map((v, i) => ({
        productId: product.id,
        sku: `TEST-${opts.slug}-${v.color}-${v.size}-${i}`.toUpperCase(),
        size: v.size,
        color: v.color,
        physical: v.physical,
        reserved: v.reserved ?? 0,
      }))
    )
    .returning()
  return { product, variants }
}

export async function stockOf(variantId: string) {
  const v = await testDb.query.productVariants.findFirst({ where: (t, { eq }) => eq(t.id, variantId) })
  return { physical: v!.physical, reserved: v!.reserved, available: v!.physical - v!.reserved }
}

let n = 0
export function customer<T extends { wilaya: string } & Record<string, unknown>>(overrides: T) {
  n += 1
  return {
    fullName: "Test Customer",
    age: 25,
    phone: "0550000001",
    email: "",
    city: "Bab Ezzouar",
    address: "1 Test Street",
    ...overrides,
  }
}
export function key() {
  n += 1
  return `test-key-${Date.now()}-${n}-${Math.random().toString(36).slice(2)}`
}

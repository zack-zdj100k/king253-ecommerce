import { and, asc, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"

import type { Db, DbOrTx } from "./db/client"
import { stores } from "./db/schema"
import { audit, type Actor } from "./audit"
import { NotFoundError, RuleError } from "./errors"

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null)

const coordinate = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number(`${label} must be a number.`).min(min, `${label} is out of range.`).max(max, `${label} is out of range.`).nullable()
  )

export const storeInput = z
  .object({
    name: z.string().trim().min(2, "Enter the shop name.").max(80),
    /** Empty = made from the wilaya (or the name). */
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(40)
      .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Slug: lowercase letters, digits and dashes only.")
      .optional()
      .nullable()
      .transform((v) => v || null),
    notificationEmail: z
      .union([z.literal(""), z.email("Enter a valid email for new-order notifications.")])
      .optional()
      .nullable()
      .transform((v) => v || null),
    wilaya: z.string().trim().min(2, "Enter the wilaya.").max(80),
    city: z.string().trim().min(2, "Enter the city.").max(80),
    address: z.string().trim().min(4, "Enter the street address.").max(300),
    phone: optional(40),
    hours: optional(500),
    mapUrl: z
      .union([z.literal(""), z.url("Paste a full link starting with https://").startsWith("https://", "Paste a full link starting with https://")])
      .optional()
      .nullable()
      .transform((v) => v || null),
    latitude: coordinate(-90, 90, "Latitude"),
    longitude: coordinate(-180, 180, "Longitude"),
    active: z.coerce.boolean().default(true),
    listed: z.coerce.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .refine((s) => (s.latitude === null) === (s.longitude === null), {
    message: "Enter both latitude and longitude, or leave both empty.",
    path: ["latitude"],
  })
export type StoreInput = z.input<typeof storeInput>
export type Store = typeof stores.$inferSelect

/**
 * activeOnly: shops that hold stock and ship orders.
 * publicOnly: active shops shown on the public Location page.
 */
export async function listStores(db: DbOrTx, opts: { activeOnly?: boolean; publicOnly?: boolean } = {}) {
  return db
    .select()
    .from(stores)
    .where(
      opts.publicOnly ? and(eq(stores.active, true), eq(stores.listed, true)) : opts.activeOnly ? eq(stores.active, true) : undefined
    )
    .orderBy(asc(stores.sortOrder), asc(stores.name))
}

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)

/** The requested slug, or one made from the wilaya/name, made unique among shops. */
async function uniqueSlug(db: DbOrTx, id: number | null, wanted: string | null, data: { wilaya: string; name: string }) {
  const explicit = Boolean(wanted)
  const base = wanted ?? (slugify(data.wilaya) || slugify(data.name) || "shop")
  for (let i = 1; i < 100; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`
    const [taken] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(id === null ? eq(stores.slug, candidate) : and(eq(stores.slug, candidate), ne(stores.id, id)))
    if (!taken) return candidate
    if (explicit) throw new RuleError(`Another shop already uses the slug "${candidate}".`)
  }
  throw new RuleError("Could not make a unique slug for this shop.")
}

export async function saveStore(db: Db, id: number | null, raw: StoreInput, actor: Actor) {
  const parsed = storeInput.parse(raw)
  const data = { ...parsed, slug: await uniqueSlug(db, id, parsed.slug, parsed) }
  if (id === null) {
    const [created] = await db.insert(stores).values(data).returning()
    await audit(db, actor, "store.create", "store", String(created.id), { name: data.name })
    return created
  }
  const [updated] = await db.update(stores).set({ ...data, updatedAt: new Date() }).where(eq(stores.id, id)).returning()
  if (!updated) throw new NotFoundError("This shop")
  await audit(db, actor, "store.update", "store", String(id), { name: data.name })
  return updated
}

export async function deleteStore(db: Db, id: number, actor: Actor) {
  const used = await db.execute<{ used: boolean }>(sql`select
      exists(select 1 from orders where store_id = ${id})
      or exists(select 1 from product_stores where store_id = ${id})
      or exists(select 1 from store_stock where store_id = ${id})
      or exists(select 1 from stock_movements where store_id = ${id}) as used`)
  if (used[0]?.used) {
    throw new RuleError("This shop has products, stock or orders, so it cannot be deleted. Untick “Active” to stop using it — its history is kept.")
  }
  const [removed] = await db.delete(stores).where(eq(stores.id, id)).returning()
  if (!removed) throw new NotFoundError("This shop")
  await audit(db, actor, "store.delete", "store", String(id), { name: removed.name, address: removed.address })
  return removed
}

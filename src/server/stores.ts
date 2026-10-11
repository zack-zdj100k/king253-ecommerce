import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import type { Db, DbOrTx } from "./db/client"
import { stores } from "./db/schema"
import { audit, type Actor } from "./audit"
import { NotFoundError } from "./errors"

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
    sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .refine((s) => (s.latitude === null) === (s.longitude === null), {
    message: "Enter both latitude and longitude, or leave both empty.",
    path: ["latitude"],
  })
export type StoreInput = z.input<typeof storeInput>
export type Store = typeof stores.$inferSelect

export async function listStores(db: DbOrTx, opts: { activeOnly?: boolean } = {}) {
  return db
    .select()
    .from(stores)
    .where(opts.activeOnly ? eq(stores.active, true) : undefined)
    .orderBy(asc(stores.sortOrder), asc(stores.name))
}

export async function saveStore(db: Db, id: number | null, raw: StoreInput, actor: Actor) {
  const data = storeInput.parse(raw)
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
  const [removed] = await db.delete(stores).where(eq(stores.id, id)).returning()
  if (!removed) throw new NotFoundError("This shop")
  await audit(db, actor, "store.delete", "store", String(id), { name: removed.name, address: removed.address })
  return removed
}

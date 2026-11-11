import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { readDeliveryCsv } from "@/lib/delivery-csv.mjs"
import { placeKey } from "@/lib/algeria"
import type { Db, DbOrTx } from "./db/client"
import { deliveryDesks, deliveryRates, stores, wilayas } from "./db/schema"
import { audit, type Actor } from "./audit"
import { NotFoundError, RuleError } from "./errors"

/*
 * Delivery prices depend on the DEPARTURE SHOP and the customer's wilaya:
 *   home  = delivery_rates.home_price
 *   desk  = the desk's own price, else delivery_rates.desk_price
 * A missing home price means "confirmed by phone" (the order is still taken);
 * desk delivery is only offered where the shop has an active desk.
 */

export type DeliveryType = "home" | "desk"

const price = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v.replace(/\s/g, "")) : v),
  z.number("Prices are whole DA amounts.").int("Prices are whole DA amounts.").min(0).max(1_000_000).nullable()
)

/* ------------------------------------------------------------------ */
/* Admin: rates                                                       */
/* ------------------------------------------------------------------ */

/** Every wilaya with this shop's prices (null = not set). */
export async function listRates(db: DbOrTx, storeId: number) {
  return db
    .select({
      code: wilayas.code,
      nameFr: wilayas.nameFr,
      nameAr: wilayas.nameAr,
      homePrice: deliveryRates.homePrice,
      deskPrice: deliveryRates.deskPrice,
      returnPrice: deliveryRates.returnPrice,
      desks: sql<number>`(select count(*) from ${deliveryDesks} d where d.store_id = ${storeId} and d.wilaya_code = ${wilayas.code} and d.active)::int`,
    })
    .from(wilayas)
    .leftJoin(deliveryRates, and(eq(deliveryRates.wilayaCode, wilayas.code), eq(deliveryRates.storeId, storeId)))
    .orderBy(asc(wilayas.code))
}

const rateRow = z.object({ wilayaCode: z.number().int().min(1).max(99), homePrice: price, deskPrice: price, returnPrice: price.optional() })
export type RateInput = z.input<typeof rateRow>

export async function saveRates(db: Db, storeId: number, raw: RateInput[], actor: Actor) {
  const rows = z.array(rateRow).max(200).parse(raw)
  await db.transaction(async (tx) => {
    const [shop] = await tx.select({ id: stores.id }).from(stores).where(eq(stores.id, storeId))
    if (!shop) throw new NotFoundError("This shop")
    for (const r of rows) await upsertRate(tx, storeId, r)
    await audit(tx, actor, "delivery.rates", "store", String(storeId), { rows: rows.length })
  })
}

async function upsertRate(tx: DbOrTx, storeId: number, r: { wilayaCode: number; homePrice: number | null; deskPrice: number | null; returnPrice?: number | null }) {
  // returnPrice undefined = leave it as it is (e.g. a CSV without that column).
  const ret = r.returnPrice === undefined ? {} : { returnPrice: r.returnPrice }
  await tx
    .insert(deliveryRates)
    .values({ storeId, wilayaCode: r.wilayaCode, homePrice: r.homePrice, deskPrice: r.deskPrice, ...ret })
    .onConflictDoUpdate({
      target: [deliveryRates.storeId, deliveryRates.wilayaCode],
      set: { homePrice: r.homePrice, deskPrice: r.deskPrice, ...ret, updatedAt: new Date() },
    })
}

/* ------------------------------------------------------------------ */
/* Admin: desks                                                       */
/* ------------------------------------------------------------------ */

export async function listDesks(db: DbOrTx, storeId: number) {
  return db
    .select({
      id: deliveryDesks.id,
      wilayaCode: deliveryDesks.wilayaCode,
      wilayaName: wilayas.nameFr,
      commune: deliveryDesks.commune,
      name: deliveryDesks.name,
      address: deliveryDesks.address,
      deskPrice: deliveryDesks.deskPrice,
      active: deliveryDesks.active,
    })
    .from(deliveryDesks)
    .innerJoin(wilayas, eq(wilayas.code, deliveryDesks.wilayaCode))
    .where(eq(deliveryDesks.storeId, storeId))
    .orderBy(asc(deliveryDesks.wilayaCode), asc(deliveryDesks.commune), asc(deliveryDesks.name))
}

export const deskInput = z.object({
  wilayaCode: z.coerce.number().int().min(1, "Choose the wilaya.").max(99),
  commune: z.string().trim().min(2, "Enter the commune.").max(80),
  name: z.string().trim().min(2, "Enter the desk name.").max(120),
  address: z.string().trim().max(300).default(""),
  deskPrice: price.optional().transform((v) => v ?? null),
  active: z.coerce.boolean().default(true),
})
export type DeskInput = z.input<typeof deskInput>

export async function saveDesk(db: Db, storeId: number, id: number | null, raw: DeskInput, actor: Actor) {
  const data = deskInput.parse(raw)
  try {
    if (id === null) {
      const [created] = await db.insert(deliveryDesks).values({ ...data, storeId }).returning()
      await audit(db, actor, "delivery.desk.create", "store", String(storeId), { name: data.name })
      return created
    }
    const [updated] = await db
      .update(deliveryDesks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(deliveryDesks.id, id), eq(deliveryDesks.storeId, storeId)))
      .returning()
    if (!updated) throw new NotFoundError("This desk")
    await audit(db, actor, "delivery.desk.update", "store", String(storeId), { id, name: data.name })
    return updated
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } }
    if ((e.cause?.code ?? e.code) === "23505") throw new RuleError("This shop already has a desk with that name in this wilaya.")
    throw error
  }
}

/** Old orders keep the desk's name in their own snapshot, so a desk can be deleted. */
export async function deleteDesk(db: Db, storeId: number, id: number, actor: Actor) {
  const [removed] = await db.delete(deliveryDesks).where(and(eq(deliveryDesks.id, id), eq(deliveryDesks.storeId, storeId))).returning()
  if (!removed) throw new NotFoundError("This desk")
  await audit(db, actor, "delivery.desk.delete", "store", String(storeId), { name: removed.name })
}

/* ------------------------------------------------------------------ */
/* Import (CSV from the couriers' PDF price lists)                    */
/* ------------------------------------------------------------------ */

export async function importDeliveryCsv(db: Db, kind: "rates" | "desks", text: string, actor: Actor) {
  const [shops, wl] = await Promise.all([
    db.select({ id: stores.id, slug: stores.slug }).from(stores),
    db.select({ code: wilayas.code, fr: wilayas.nameFr, ar: wilayas.nameAr }).from(wilayas),
  ])
  const { rows, errors } = readDeliveryCsv(kind, text, { shops, wilayas: wl })
  if (errors.length) {
    const more = errors.length > 8 ? ` …and ${errors.length - 8} more.` : ""
    throw new RuleError(`Nothing imported. ${errors.slice(0, 8).join(" ")}${more}`)
  }
  if (!rows.length) throw new RuleError("The file has a header but no rows.")
  await db.transaction(async (tx) => {
    if (kind === "rates") {
      for (const r of rows as { storeId: number; wilayaCode: number; homePrice: number | null; deskPrice: number | null; returnPrice?: number | null }[]) {
        await upsertRate(tx, r.storeId, r)
      }
    } else {
      for (const d of rows as { storeId: number; wilayaCode: number; commune: string; name: string; address: string; deskPrice: number | null }[]) {
        await tx
          .insert(deliveryDesks)
          .values({ ...d, active: true })
          .onConflictDoUpdate({
            target: [deliveryDesks.storeId, deliveryDesks.wilayaCode, deliveryDesks.name],
            set: { commune: d.commune, address: d.address, deskPrice: d.deskPrice, active: true, updatedAt: new Date() },
          })
      }
    }
    await audit(tx, actor, `delivery.import.${kind}`, "delivery", kind, { rows: rows.length })
  })
  return rows.length
}

/* ------------------------------------------------------------------ */
/* Checkout                                                           */
/* ------------------------------------------------------------------ */

export type Desk = { id: number; storeId: number; commune: string; name: string; address: string; price: number | null }

/** Active desks of these shops in one wilaya, each with its effective price. */
export async function desksFor(db: DbOrTx, wilayaCode: number, storeIds: number[]): Promise<Desk[]> {
  if (!storeIds.length) return []
  const rows = await db
    .select({
      id: deliveryDesks.id,
      storeId: deliveryDesks.storeId,
      commune: deliveryDesks.commune,
      name: deliveryDesks.name,
      address: deliveryDesks.address,
      price: sql<number | null>`coalesce(${deliveryDesks.deskPrice}, ${deliveryRates.deskPrice})`,
    })
    .from(deliveryDesks)
    .leftJoin(deliveryRates, and(eq(deliveryRates.storeId, deliveryDesks.storeId), eq(deliveryRates.wilayaCode, deliveryDesks.wilayaCode)))
    .where(and(eq(deliveryDesks.wilayaCode, wilayaCode), inArray(deliveryDesks.storeId, storeIds), eq(deliveryDesks.active, true)))
    .orderBy(asc(deliveryDesks.commune), asc(deliveryDesks.name))
  return rows
}

/** Home-delivery price per shop for a wilaya (null = confirmed by phone). */
export async function homePrices(db: DbOrTx, wilayaCode: number, storeIds: number[]) {
  const out = new Map<number, number | null>(storeIds.map((id) => [id, null]))
  if (!storeIds.length) return out
  const rows = await db
    .select({ storeId: deliveryRates.storeId, homePrice: deliveryRates.homePrice })
    .from(deliveryRates)
    .where(and(eq(deliveryRates.wilayaCode, wilayaCode), inArray(deliveryRates.storeId, storeIds)))
  for (const r of rows) out.set(r.storeId, r.homePrice)
  return out
}

/** Wilaya-level Stop desk price per shop (null = none). Used when a shop has no listed desk there. */
export async function deskPrices(db: DbOrTx, wilayaCode: number, storeIds: number[]) {
  const out = new Map<number, number | null>(storeIds.map((id) => [id, null]))
  if (!storeIds.length) return out
  const rows = await db
    .select({ storeId: deliveryRates.storeId, deskPrice: deliveryRates.deskPrice })
    .from(deliveryRates)
    .where(and(eq(deliveryRates.wilayaCode, wilayaCode), inArray(deliveryRates.storeId, storeIds)))
  for (const r of rows) out.set(r.storeId, r.deskPrice)
  return out
}

/**
 * Closest desk without a map: same commune first, then the desk in the wilaya's
 * main town (commune named like the wilaya), then the first one.
 */
export function suggestDesk<T extends { commune: string }>(desks: T[], commune: string | null | undefined, wilayaName: string): T | null {
  if (!desks.length) return null
  const k = placeKey(commune ?? "")
  return (
    (k && desks.find((d) => placeKey(d.commune) === k)) ||
    (k && desks.find((d) => placeKey(d.commune).includes(k) || k.includes(placeKey(d.commune)))) ||
    desks.find((d) => placeKey(d.commune) === placeKey(wilayaName)) ||
    desks[0]
  )
}

export type ShopQuote = {
  storeId: number
  storeName: string
  /** Delivery price for the chosen type; null = confirmed by phone (home) — desks always have a desk list. */
  price: number | null
  /** Desk delivery only: desks of this shop in the wilaya + the suggested one. */
  desks: Desk[]
  suggestedDeskId: number | null
  available: boolean
}

/**
 * What each eligible shop charges to deliver to this wilaya with this type.
 * Sorted cheapest first (unknown prices last); the first is pre-selected.
 */
export async function quoteShops(
  db: DbOrTx,
  input: { shops: { id: number; name: string }[]; wilayaCode: number; wilayaName: string; commune?: string | null; type: DeliveryType }
): Promise<ShopQuote[]> {
  const ids = input.shops.map((s) => s.id)
  const quotes: ShopQuote[] =
    input.type === "home"
      ? await homePrices(db, input.wilayaCode, ids).then((prices) =>
          input.shops.map((s) => ({ storeId: s.id, storeName: s.name, price: prices.get(s.id) ?? null, desks: [], suggestedDeskId: null, available: true }))
        )
      : await Promise.all([desksFor(db, input.wilayaCode, ids), deskPrices(db, input.wilayaCode, ids)]).then(([desks, rates]) =>
          input.shops.map((s) => {
            const own = desks.filter((d) => d.storeId === s.id)
            const suggested = suggestDesk(own, input.commune, input.wilayaName)
            // No listed desk but the courier's wilaya Stop desk price is known: the customer collects at the courier's
            // agency and our team confirms its address by phone (no desk to choose).
            const wilayaPrice = rates.get(s.id) ?? null
            if (!own.length && wilayaPrice !== null) return { storeId: s.id, storeName: s.name, price: wilayaPrice, desks: [], suggestedDeskId: null, available: true }
            return { storeId: s.id, storeName: s.name, price: suggested?.price ?? null, desks: own, suggestedDeskId: suggested?.id ?? null, available: own.length > 0 }
          })
        )
  return quotes.sort((a, b) => Number(!a.available) - Number(!b.available) || (a.price ?? Infinity) - (b.price ?? Infinity))
}

/** The courier's return fee for an order's shop and wilaya (null = not set for that shop yet). */
export async function returnPriceFor(db: DbOrTx, storeId: number | null, wilayaCode: number | null) {
  if (!storeId || !wilayaCode) return null
  const [r] = await db
    .select({ v: deliveryRates.returnPrice })
    .from(deliveryRates)
    .where(and(eq(deliveryRates.storeId, storeId), eq(deliveryRates.wilayaCode, wilayaCode)))
  return r?.v ?? null
}

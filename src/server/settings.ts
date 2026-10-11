import { eq, inArray } from "drizzle-orm"
import { z } from "zod"

import type { DbOrTx } from "./db/client"
import { settings } from "./db/schema"

/**
 * Global settings with safe defaults. Unknown contact details stay empty —
 * nothing here is invented business data.
 */
export const settingsSchema = z.object({
  brandName: z.string().trim().min(1).max(60).default("KING 253"),
  contactPhone: z.string().trim().max(40).default(""),
  contactEmail: z.union([z.literal(""), z.email()]).default(""),
  whatsapp: z.string().trim().max(40).default(""),
  instagram: z.string().trim().max(120).default(""),
  tiktok: z.string().trim().max(120).default(""),
  facebook: z.string().trim().max(200).default(""),
  /** One fee for every home delivery in Algeria; 0 = confirmed by phone. */
  deliveryFee: z.coerce.number().int().min(0).max(100000).default(0),
  /** "Developed by" credit in the footer; hidden while all are empty. */
  developerName: z.string().trim().max(80).default(""),
  developerPhone: z.string().trim().max(40).default(""),
  developerEmail: z.union([z.literal(""), z.email()]).default(""),
  developerGithub: z.string().trim().max(200).default(""),
  /** Free-delivery promotion: the shop pays the courier instead of the customer. */
  freeDelivery: z.coerce.boolean().default(false),
  /** Free delivery only from this clothes total (DA); 0 = every order. */
  freeDeliveryMin: z.coerce.number().int().min(0).max(10_000_000).default(0),
  /** Shown at checkout, e.g. "2–5 days". Empty = hidden. */
  deliveryEstimate: z.string().trim().max(60).default(""),
  currency: z.literal("DZD").default("DZD"),
  orderPrefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{2,16}$/, "Use 2–16 capital letters or digits.")
    .default("KING253"),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000).default(3),
  abandonedCartHours: z.coerce.number().int().min(1).max(24 * 30).default(2),
  adminNotifyEmail: z.union([z.literal(""), z.email()]).default(""),
  emailFromName: z.string().trim().max(60).default("KING 253"),
  customerEmailsEnabled: z.coerce.boolean().default(true),
  /** Vacation mode: storefront closed between closedFrom and closedUntil (ISO; empty = now / until reopened). */
  shopClosed: z.boolean().default(false),
  closedFrom: z.string().trim().max(40).refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Invalid start date.").default(""),
  closedUntil: z.string().trim().max(40).refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Invalid reopening date.").default(""),
  /** Shown to visitors while closed. Empty = a standard message. */
  closedMessage: z.string().trim().max(300).default(""),
})

export type Settings = z.infer<typeof settingsSchema>
export type SettingKey = keyof Settings

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({})

export async function getSettings(db: DbOrTx): Promise<Settings> {
  const rows = await db.select().from(settings)
  const raw: Record<string, unknown> = {}
  for (const row of rows) raw[row.key] = row.value
  const parsed = settingsSchema.safeParse(raw)
  // A corrupted value must never take the shop down — fall back per key.
  if (parsed.success) return parsed.data
  const merged = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    const one = settingsSchema.shape[key].safeParse(raw[key])
    if (one.success) (merged as Record<string, unknown>)[key] = one.data
  }
  return merged
}

export async function getSetting<K extends SettingKey>(db: DbOrTx, key: K): Promise<Settings[K]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  const parsed = settingsSchema.shape[key].safeParse(row?.value)
  return (parsed.success ? parsed.data : DEFAULT_SETTINGS[key]) as Settings[K]
}

export async function saveSettings(db: DbOrTx, values: Partial<Settings>) {
  const entries = Object.entries(values).filter(([key, value]) => key in DEFAULT_SETTINGS && value !== undefined)
  if (!entries.length) return
  await db.delete(settings).where(inArray(settings.key, entries.map(([k]) => k)))
  await db.insert(settings).values(entries.map(([key, value]) => ({ key, value, updatedAt: new Date() })))
}

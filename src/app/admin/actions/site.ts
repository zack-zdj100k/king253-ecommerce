"use server"

import { z } from "zod"

import { db } from "@/server/db"
import { audit } from "@/server/audit"
import { deleteCart } from "@/server/cart"
import { deleteCustomer } from "@/server/customers"
import { CONTENT_SECTIONS, saveContent, type ContentKey } from "@/server/content"
import { AppError } from "@/server/errors"
import { saveSettings, settingsSchema } from "@/server/settings"
import { deleteStore, saveStore, storeInput, type StoreInput } from "@/server/stores"
import { deleteMedia, listMedia } from "@/server/media"
import { requireAdmin } from "@/server/auth/session"
import { adminAction } from "./_shared"

/* Shops (Location page) ------------------------------------------ */

const storePaths = ["/admin/locations", "/location", "/"]

export async function saveStoreAction(storeId: number | null, input: StoreInput) {
  return adminAction(
    async ({ actor }) => {
      const parsed = storeInput.safeParse(input)
      if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the shop details.")
      await saveStore(db, storeId === null ? null : z.number().int().positive().parse(storeId), parsed.data, actor)
    },
    { revalidate: storePaths, message: "Shop saved." }
  )
}

export async function deleteStoreAction(storeId: number) {
  return adminAction(
    async ({ actor }) => {
      await deleteStore(db, z.number().int().positive().parse(storeId), actor)
    },
    { revalidate: storePaths, message: "Shop deleted." }
  )
}

/* Customers & abandoned bags -------------------------------------- */

export async function deleteCustomerAction(customerId: string) {
  return adminAction(
    async ({ actor }) => {
      await deleteCustomer(db, z.uuid().parse(customerId), actor)
    },
    { revalidate: ["/admin/customers", "/admin"], message: "Customer deleted." }
  )
}

export async function deleteCartAction(cartId: string) {
  return adminAction(
    async ({ actor }) => {
      const removed = await deleteCart(db, z.uuid().parse(cartId))
      if (!removed) throw new AppError("NOT_FOUND", "This bag was already removed.")
      await audit(db, actor, "cart.delete", "cart", cartId, {})
    },
    { revalidate: ["/admin/abandoned", "/admin"], message: "Abandoned bag deleted." }
  )
}

/* CMS ------------------------------------------------------------- */

export async function saveContentAction(key: string, data: Record<string, string>) {
  return adminAction(
    async ({ actor }) => {
      if (!(key in CONTENT_SECTIONS)) throw new AppError("UNKNOWN", "Unknown section.")
      const clean = z.record(z.string(), z.string().max(5000)).parse(data)
      await saveContent(db, key as ContentKey, clean)
      await audit(db, actor, "content.save", "content", key, {})
    },
    { revalidate: ["/", "/who-is-king", "/clothes", "/location", "/admin/content"], message: "Saved — live on the website now." }
  )
}

/* Settings -------------------------------------------------------- */

export async function saveSettingsAction(values: Record<string, unknown>) {
  return adminAction(
    async ({ actor }) => {
      const parsed = settingsSchema.partial().safeParse(values)
      if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the settings.")
      await saveSettings(db, parsed.data)
      await audit(db, actor, "settings.save", "settings", "global", { keys: Object.keys(parsed.data) })
    },
    { revalidate: ["/", "/location", "/checkout", "/admin/settings", "/admin"], message: "Settings saved." }
  )
}

/* Media library ---------------------------------------------------- */

export async function listMediaAction() {
  await requireAdmin()
  return listMedia()
}

export async function deleteMediaAction(url: string) {
  return adminAction(
    async ({ actor }) => {
      const clean = z.string().max(300).parse(url)
      await deleteMedia(db, clean)
      await audit(db, actor, "media.delete", "media", clean, {})
    },
    { message: "Image deleted." }
  )
}

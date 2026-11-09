"use server"

import { z } from "zod"

import { db } from "@/server/db"
import { deleteDesk, importDeliveryCsv, saveDesk, saveRates, type DeskInput, type RateInput } from "@/server/shipping"
import { adminAction } from "./_shared"

const shopId = z.number().int().positive()
const paths = ["/admin/delivery", "/checkout"]

export async function saveRatesAction(storeId: number, rows: RateInput[]) {
  return adminAction(
    async ({ actor }) => {
      await saveRates(db, shopId.parse(storeId), rows, actor)
    },
    { revalidate: paths, message: "Delivery prices saved." }
  )
}

export async function saveDeskAction(storeId: number, deskId: number | null, input: DeskInput) {
  return adminAction(
    async ({ actor }) => {
      await saveDesk(db, shopId.parse(storeId), deskId === null ? null : z.number().int().positive().parse(deskId), input, actor)
    },
    { revalidate: paths, message: "Desk saved." }
  )
}

export async function deleteDeskAction(storeId: number, deskId: number) {
  return adminAction(
    async ({ actor }) => {
      await deleteDesk(db, shopId.parse(storeId), z.number().int().positive().parse(deskId), actor)
    },
    { revalidate: paths, message: "Desk deleted." }
  )
}

export async function importDeliveryAction(kind: "rates" | "desks", text: string) {
  return adminAction(
    async ({ actor }) => {
      const n = await importDeliveryCsv(db, z.enum(["rates", "desks"]).parse(kind), z.string().max(2_000_000).parse(text), actor)
      return { imported: n }
    },
    { revalidate: paths, message: "Import done." }
  )
}

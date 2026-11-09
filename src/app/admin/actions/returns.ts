"use server"

import { db } from "@/server/db"
import { recordExchange, recordReturn, type ExchangeInput, type ReturnInput } from "@/server/returns"
import { adminAction } from "./_shared"

const paths = (orderId: string) => [`/admin/orders/${orderId}`, "/admin/returns", "/admin/inventory", "/admin"]

export async function recordReturnAction(input: ReturnInput) {
  return adminAction(
    async ({ actor }) => {
      const r = await recordReturn(db, input, actor)
      return { amount: r.amount, full: r.full }
    },
    { revalidate: paths(String(input.orderId)), message: "Return recorded. Stock is back in the shop." }
  )
}

export async function recordExchangeAction(input: ExchangeInput) {
  return adminAction(
    async ({ actor }) => {
      const r = await recordExchange(db, input, actor)
      return { amount: r.amount }
    },
    { revalidate: paths(String(input.orderId)), message: "Exchange recorded. Stock updated both ways." }
  )
}

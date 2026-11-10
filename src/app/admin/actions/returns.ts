"use server"

import { db } from "@/server/db"
import { recordExchange, recordReturn, returnableItems, type ExchangeInput, type ReturnInput } from "@/server/returns"
import { RuleError } from "@/server/errors"
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

/** "Returned": every piece still with the customer comes back to the order's shop in one step. */
export async function returnEverythingAction(orderId: string, reason: string, note: string) {
  return adminAction(
    async ({ actor }) => {
      const left = await returnableItems(db, orderId)
      if (!left.length) throw new RuleError("Nothing left to return on this order.")
      const r = await recordReturn(db, { orderId, returned: left.map((i) => ({ orderItemId: i.id, quantity: i.left })), reason, note }, actor)
      return { amount: r.amount, full: r.full }
    },
    { revalidate: paths(String(orderId)), message: "Whole order returned. Stock is back in the shop and the order is out of revenue." }
  )
}

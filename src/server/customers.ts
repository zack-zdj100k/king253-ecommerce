import { and, eq, notInArray, sql } from "drizzle-orm"

import type { Db, DbOrTx } from "./db/client"
import { carts, customers, orders, users } from "./db/schema"
import { audit, type Actor } from "./audit"
import { AppError, NotFoundError } from "./errors"
import type { CustomerInfo } from "./validation"

/**
 * Returning customers are recognised by phone — one record per person.
 * Latest details win; an email is never erased by a later order without one.
 */
export async function upsertCustomerByPhone(db: DbOrTx, info: CustomerInfo) {
  const [row] = await db
    .insert(customers)
    .values({
      phone: info.phone,
      fullName: info.fullName,
      email: info.email,
      age: info.age,
      wilaya: info.wilaya,
      city: info.city,
      address: info.address,
    })
    .onConflictDoUpdate({
      target: customers.phone,
      set: {
        fullName: info.fullName,
        email: sql`coalesce(${info.email}, ${customers.email})`,
        age: info.age,
        wilaya: info.wilaya,
        city: info.city,
        address: info.address,
        updatedAt: new Date(),
      },
    })
    .returning({ id: customers.id })
  return row.id
}

/**
 * Deletes a customer record. Their orders stay (they are the shop's sales
 * history and keep the name/phone typed at checkout) but are unlinked.
 * Blocked while an order is still open, so nobody gets lost mid-delivery.
 */
export async function deleteCustomer(db: Db, id: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const [customer] = await tx.select().from(customers).where(eq(customers.id, id)).for("update")
    if (!customer) throw new NotFoundError("This customer")
    const [open] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.customerId, id), notInArray(orders.status, ["delivered", "cancelled"])))
    if (open.n > 0) {
      throw new AppError("CUSTOMER_HAS_OPEN_ORDERS", `${customer.fullName} has ${open.n} open order(s). Deliver or cancel them first.`)
    }
    await tx.update(users).set({ customerId: null }).where(eq(users.customerId, id))
    await tx.update(carts).set({ customerId: null }).where(eq(carts.customerId, id))
    await tx.delete(customers).where(eq(customers.id, id))
    await audit(tx, actor, "customer.delete", "customer", id, { name: customer.fullName, phone: customer.phone })
    return customer
  })
}

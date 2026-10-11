import type { Metadata } from "next"
import Link from "next/link"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { db } from "@/server/db"
import { productVariants, products } from "@/server/db/schema"
import { variantMovements } from "@/server/admin/queries"
import { StockAdjust } from "@/components/admin/product/stock-adjust"
import { deleteInventoryVariantAction } from "@/app/admin/actions/products"
import { DeleteButton } from "@/components/admin/delete-button"
import { PageHeader, Panel, Stat, Table, td, th } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Stock ledger" }

const TYPE: Record<string, string> = {
  adjustment: "Manual adjustment",
  reserve: "Reserved (order)",
  release: "Released (cancel / edit)",
  deliver: "Delivered",
  return_restock: "Return restocked",
  exchange_ship: "Exchange shipped",
}

export default async function LedgerPage({ params }: PageProps<"/admin/inventory/[variantId]">) {
  const { variantId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) notFound()
  const [row] = await db
    .select({ v: productVariants, name: products.name, productId: products.id })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, variantId))
  if (!row) notFound()
  const moves = await variantMovements(db, variantId, 200)
  const { v } = row

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Stock ledger · ${v.sku}`}
        title={`${row.name} — ${v.color} / ${v.size}`}
        actions={<DeleteButton label="Delete variant" confirm="Delete this size/colour and its ledger?" action={deleteInventoryVariantAction.bind(null, v.id)} redirectTo="/admin/inventory" />}
      >
        <Link href={`/admin/products/${row.productId}`} className="mt-3 inline-block text-xs font-medium text-king-gray hover:text-king-white">← Product</Link>
      </PageHeader>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Physical" value={v.physical} hint={<StockAdjust variantId={v.id} physical={v.physical} reserved={v.reserved} />} />
        <Stat label="Reserved" value={v.reserved} hint="Held by open orders" />
        <Stat label="Available" value={v.physical - v.reserved} tone="red" />
      </div>
      <Panel title="Every movement">
        <Table className="-m-5 w-[calc(100%+2.5rem)] max-w-none border-0 bg-transparent">
          <thead>
            <tr>
              <th className={th}>When</th>
              <th className={th}>Type</th>
              <th className={`${th} text-right`}>Physical</th>
              <th className={`${th} text-right`}>Reserved</th>
              <th className={th}>Reason · by</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m) => (
              <tr key={m.id}>
                <td className={td}>{m.createdAt.toLocaleString("en-GB")}</td>
                <td className={td}>{TYPE[m.type] ?? m.type}</td>
                <td className={`${td} text-right tabular-nums`}>{m.physicalBefore} → <span className="text-king-white">{m.physicalAfter}</span></td>
                <td className={`${td} text-right tabular-nums`}>{m.reservedBefore} → <span className="text-king-white">{m.reservedAfter}</span></td>
                <td className={td}>
                  {m.reason ?? "—"} {m.actor ? <span className="text-king-gray">· {m.actor}</span> : null}
                  {m.refType === "order" && m.refId ? (
                    <Link href={`/admin/orders/${m.refId}`} className="ml-2 text-xs text-king-gray hover:text-king-white">order ↗</Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  )
}

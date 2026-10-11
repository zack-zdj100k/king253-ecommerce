import type { Metadata } from "next"

import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { db } from "@/server/db"
import { getAbandonedCarts } from "@/server/analytics"
import { resolveRange } from "@/server/admin/queries"
import { getSetting } from "@/server/settings"
import { RangeTabs } from "@/components/admin/charts"
import { deleteCartAction } from "@/app/admin/actions/site"
import { DeleteButton } from "@/components/admin/delete-button"
import { Empty, PageHeader, Stat, Table, td, th } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Abandoned carts" }

export default async function AbandonedPage({ searchParams }: PageProps<"/admin/abandoned">) {
  const p = await searchParams
  const one = (v: unknown) => (typeof v === "string" ? v : undefined)
  const { key, range, label } = resolveRange(one(p.range) ?? "30d", one(p.from), one(p.to))
  const hours = await getSetting(db, "abandonedCartHours")
  const report = await getAbandonedCarts(db, { hours, range, limit: 100 })
  const started = report.carts.filter((c) => c.checkoutStartedAt).length
  const withInfo = report.carts.filter((c) => c.infoEnteredAt).length

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insight" title="Abandoned carts">
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          Bags with items and no activity for {hours}h. Adding to a bag never reserves stock. No messages are sent automatically.
        </p>
        <div className="mt-4"><RangeTabs current={key} base="/admin/abandoned" label={label} /></div>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Abandoned carts" value={report.count} />
        <Stat label="Potential revenue" value={formatDA(report.estimatedValue)} tone="red" hint="At current prices" />
        <Stat label="Started checkout" value={started} hint="In the list below" />
        <Stat label="Entered details" value={withInfo} hint="Name/phone known" />
      </div>
      {report.carts.length === 0 ? (
        <Empty>No abandoned carts in this period.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Last activity</th>
              <th className={th}>Items</th>
              <th className={th}>Customer</th>
              <th className={th}>Progress</th>
              <th className={`${th} text-right`}>Value</th>
              <th className={th}><span className="sr-only">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {report.carts.map((c) => (
              <tr key={c.id}>
                <td className={td}>{c.lastActivityAt.toLocaleString("en-GB")}</td>
                <td className={td}>{c.items.map((i) => `${i.name} (${i.color}/${i.size}) ×${i.quantity}`).join(", ")}</td>
                <td className={td}>
                  {c.name ? <span className="text-king-white">{c.name}</span> : "Unknown"}
                  {c.phone && <span className="block text-xs">{formatPhone(c.phone)}</span>}
                  {c.wilaya && <span className="block text-xs">{c.wilaya}</span>}
                </td>
                <td className={td}>
                  {c.orderId ? "Ordered other items" : c.infoEnteredAt ? "Entered details" : c.checkoutStartedAt ? "Started checkout" : "Bag only"}
                </td>
                <td className={`${td} text-right text-king-white`}>{formatDA(c.value)}</td>
                <td className={`${td} w-px text-right`}>
                  <DeleteButton compact label="Delete abandoned bag" confirm="Delete bag?" action={deleteCartAction.bind(null, c.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}

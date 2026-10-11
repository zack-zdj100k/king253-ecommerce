import type { Metadata } from "next"
import Link from "next/link"

import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { db } from "@/server/db"
import { listOrders } from "@/server/admin/queries"
import { ORDER_STATUSES, STATUS_LABELS } from "@/server/orders/manage"
import { deleteOrderAction } from "@/app/admin/actions/orders"
import { DeleteButton } from "@/components/admin/delete-button"
import { Badge, Empty, PageHeader, Table, inputClass, selectClass, td, th, btnRed, pill } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Orders" }

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const p = await searchParams
  const one = (v: unknown) => (typeof v === "string" ? v : undefined)
  const filters = { q: one(p.q), status: one(p.status) ?? "all", sort: one(p.sort) ?? "newest", page: Number(one(p.page)) || 1 }
  const { rows, total, page, pages } = await listOrders(db, filters)
  const qs = (patch: Record<string, string>) => {
    const s = new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), status: filters.status, sort: filters.sort, ...patch })
    return `/admin/orders?${s}`
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Sales" title="Orders">
        <p className="mt-2 text-sm text-king-gray">{total} order(s)</p>
      </PageHeader>

      <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_200px_auto]" action="/admin/orders">
        <input name="q" defaultValue={filters.q} placeholder="Search number, name or phone" aria-label="Search orders" className={inputClass} />
        <select name="status" defaultValue={filters.status} aria-label="Status" className={selectClass}>
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select name="sort" defaultValue={filters.sort} aria-label="Sort" className={selectClass}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total_desc">Highest total</option>
          <option value="total_asc">Lowest total</option>
        </select>
        <button type="submit" className={btnRed}>Filter</button>
      </form>

      {rows.length === 0 ? (
        <Empty>No orders match.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Date</th>
              <th className={th}>Customer</th>
              <th className={th}>Wilaya</th>
              <th className={th}>Items</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Clothes · delivery</th>
              <th className={th}><span className="sr-only">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-white/[0.02]">
                <td className={td}>
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-king-white hover:text-king-bright-red">{o.number}</Link>
                  {o.shipsWith && <span className="block text-xs text-king-gray">Ships with {o.shipsWith}</span>}
                </td>
                <td className={td}>{o.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td className={td}>
                  <span className="block text-king-white">{o.customerName}</span>
                  <span className="text-xs">{formatPhone(o.customerPhone)}</span>
                </td>
                <td className={td}>{o.wilayaName}</td>
                <td className={td}>{o.items}</td>
                <td className={td}><Badge status={o.status}>{STATUS_LABELS[o.status]}</Badge></td>
                <td className={`${td} text-right`}>
                  <span className="block text-king-white">{formatDA(o.clothes)}</span>
                  <span className="text-xs">
                    {o.shipsWith ? `+ delivery in ${o.shipsWith}` : o.freeDelivery ? "free delivery" : o.deliveryFee > 0 ? `+ ${formatDA(o.deliveryFee)} delivery` : "+ delivery to confirm"}
                  </span>
                </td>
                <td className={`${td} w-px text-right`}>
                  <DeleteButton compact label={`Delete order ${o.number}`} confirm="Delete order?" action={deleteOrderAction.bind(null, o.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex flex-wrap gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={qs({ page: String(n) })} aria-current={n === page ? "page" : undefined} className={pill(n === page)}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

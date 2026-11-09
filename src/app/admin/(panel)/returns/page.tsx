import type { Metadata } from "next"
import Link from "next/link"

import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { db } from "@/server/db"
import { listJournal } from "@/server/returns"
import { listStores } from "@/server/stores"
import { Empty, PageHeader, Stat, Table, inputClass, pill, td, th } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Returns & exchanges" }

const TYPES = [
  ["return", "Returns"],
  ["exchange", "Exchanges"],
] as const

const fmt = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
const day = (d: Date) => d.toISOString().slice(0, 10)

/**
 * The journal: every return and exchange recorded on delivered orders.
 * Filters: period (default last 30 days), shop, type — each list shows one
 * choice at a time (no "All" option).
 */
export default async function ReturnsJournalPage({ searchParams }: PageProps<"/admin/returns">) {
  const p = await searchParams
  const one = (v: unknown) => (typeof v === "string" ? v : undefined)
  const shops = await listStores(db)
  const shop = shops.find((s) => String(s.id) === one(p.shop)) ?? shops.find((s) => s.active) ?? shops[0]
  const type = TYPES.some(([k]) => k === one(p.type)) ? (one(p.type) as "return" | "exchange") : "return"
  const today = new Date()
  const parse = (v: string | undefined, fallback: Date) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : fallback)
  const from = parse(one(p.from), new Date(today.getTime() - 29 * 86_400_000))
  const to = parse(one(p.to), today)
  const page = Number(one(p.page)) || 1
  const qs = (patch: Record<string, string | number>) =>
    `/admin/returns?${new URLSearchParams({ shop: String(shop?.id ?? ""), type, from: day(from), to: day(to), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) })}`

  if (!shop) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Sales" title="Returns & exchanges" />
        <Empty>No shop yet.</Empty>
      </div>
    )
  }
  const { rows, totals, total, pages } = await listJournal(db, {
    from: new Date(`${day(from)}T00:00:00Z`),
    to: new Date(new Date(`${day(to)}T00:00:00Z`).getTime() + 86_400_000),
    storeId: shop.id,
    type,
    page,
  })

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Sales" title="Returns & exchanges">
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          Journal of every return and exchange. Record them from a delivered order (Orders → order → Returns & exchanges). Refunds come off
          revenue; an order whose every item came back counts as refused and leaves the statistics.
        </p>
      </PageHeader>

      <nav aria-label="Shop" className="flex flex-wrap gap-2">
        {shops.map((s) => (
          <Link key={s.id} href={qs({ shop: s.id, page: 1 })} className={pill(s.id === shop.id)}>
            {s.name}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-end gap-2">
        {TYPES.map(([k, label]) => (
          <Link key={k} href={qs({ type: k, page: 1 })} className={pill(type === k)}>
            {label}
          </Link>
        ))}
        <form action="/admin/returns" className="ml-auto flex flex-wrap items-end gap-2">
          <input type="hidden" name="shop" value={shop.id} />
          <input type="hidden" name="type" value={type} />
          <label className="text-xs text-king-gray">
            From
            <input type="date" name="from" defaultValue={day(from)} className={`${inputClass} h-9 w-40`} />
          </label>
          <label className="text-xs text-king-gray">
            To
            <input type="date" name="to" defaultValue={day(to)} className={`${inputClass} h-9 w-40`} />
          </label>
          <button type="submit" className={pill(false)}>
            Apply
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Returns" value={totals.returns} />
        <Stat label="Exchanges" value={totals.exchanges} />
        <Stat label="Refunded" value={formatDA(totals.refunded)} tone={totals.refunded ? "red" : undefined} />
        <Stat label="Collected (exchanges)" value={formatDA(totals.collected)} />
      </div>
      <p className="text-xs text-king-gray">
        {total} {type === "return" ? "return(s)" : "exchange(s)"} in {shop.name}, {day(from)} → {day(to)}
      </p>

      {rows.length === 0 ? (
        <Empty>Nothing recorded for this shop and period.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Order · customer</th>
              <th className={th}>Items</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>By · reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.entry.id} className="align-top">
                <td className={td}>{fmt(r.entry.createdAt)}</td>
                <td className={td}>
                  <Link href={`/admin/orders/${r.entry.orderId}#returns`} className="font-medium text-king-white hover:text-king-bright-red">
                    {r.orderNumber}
                  </Link>
                  <span className="block text-xs">
                    {r.customerName} · {formatPhone(r.customerPhone)}
                  </span>
                </td>
                <td className={td}>
                  {r.items.map((i) => (
                    <span key={i.id} className="block text-xs">
                      {i.direction === "in" ? "↩" : "→"} {i.productName} — {i.color} / {i.size} × {i.quantity}
                    </span>
                  ))}
                </td>
                <td className={`${td} text-right tabular-nums ${r.entry.amount < 0 ? "text-king-bright-red" : r.entry.amount > 0 ? "text-emerald-300" : ""}`}>
                  {r.entry.amount < 0 ? `− ${formatDA(-r.entry.amount)}` : r.entry.amount > 0 ? `+ ${formatDA(r.entry.amount)}` : "0"}
                </td>
                <td className={td}>
                  {r.entry.actorLabel}
                  <span className="block text-xs">
                    {r.entry.reason ?? ""}
                    {r.entry.note ? ` — ${r.entry.note}` : ""}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={qs({ page: n })} className={pill(n === page)}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

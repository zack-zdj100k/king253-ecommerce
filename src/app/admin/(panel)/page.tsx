import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { formatDA } from "@/lib/money"
import { db } from "@/server/db"
import { getAbandonedCarts, getAnalytics } from "@/server/analytics"
import { lowStockVariants, recentOrders, resolveRange } from "@/server/admin/queries"
import { STATUS_LABELS } from "@/server/orders/manage"
import { getSettings } from "@/server/settings"
import { RangeTabs, RankList } from "@/components/admin/charts"
import { RevenueChart } from "@/components/admin/revenue-chart"
import { Badge, LinkButton, PageHeader, Panel, Stat, Table, td, th } from "@/components/admin/ui"

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const p = await searchParams
  const one = (v: unknown) => (typeof v === "string" ? v : undefined)
  const { key, range, label } = resolveRange(one(p.range) ?? "30d", one(p.from), one(p.to))
  const settings = await getSettings(db)
  const [a, abandoned, recent, low] = await Promise.all([
    getAnalytics(db, range),
    getAbandonedCarts(db, { hours: settings.abandonedCartHours, range, limit: 1 }),
    recentOrders(db),
    lowStockVariants(db, settings.lowStockThreshold),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        actions={
          <>
            <LinkButton href="/admin/orders?status=pending">Pending orders</LinkButton>
            <LinkButton href="/admin/reviews">Moderate reviews</LinkButton>
          </>
        }
      >
        <div className="mt-4">
          <RangeTabs current={key} base="/admin" label={label} />
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Net revenue"
          value={formatDA(a.bookedRevenue)}
          hint={
            <>
              Sales {formatDA(a.sales)}
              {a.refunds > 0 && <> − refunds {formatDA(a.refunds)}</>}
              {a.deliveryPaid > 0 && <> − delivery paid {formatDA(a.deliveryPaid)}</>}
            </>
          }
        />
        <Stat label="Delivered revenue" value={formatDA(a.deliveredRevenue)} hint={`${a.delivered} delivered · net of returns`} tone="red" />
        <Stat label="Orders" value={a.orders} hint={`${a.pending} open · ${a.cancelled} cancelled`} />
        <Stat label="Avg order value" value={formatDA(a.averageOrderValue)} hint={`Before returns · ${a.itemsPerOrder} items / order`} />
        <Stat label="Conversion" value={a.conversionRate === null ? "—" : `${a.conversionRate}%`} hint={`${a.viewers} visitors viewed products`} />
        <Stat label="Units sold" value={a.units} hint={a.returnedUnits > 0 ? `Kept by customers · ${a.returnedUnits} returned` : "Kept by customers"} />
        <Stat label="Abandoned carts" value={abandoned.count} hint={`≈ ${formatDA(abandoned.estimatedValue)} potential`} />
        <Stat label="Low stock" value={low.length} hint="Variants at or under threshold" tone={low.length ? "red" : undefined} />
      </div>

      <section className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-2 px-4 pb-2">
          <h2 className="text-[13px] font-semibold tracking-[0.01em] text-[var(--ios-label-2)] uppercase">Performance — {label}</h2>
          <span className="text-[12px] text-[var(--ios-label-3)]">% vs the previous period of the same length</span>
        </div>
        <RevenueChart data={a.byDay} from={range.from.toISOString()} to={range.to.toISOString()} current={a.current} previous={a.previous} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Latest orders" actions={<Link href="/admin/orders" className="text-xs font-medium text-king-gray hover:text-king-white">All orders</Link>}>
          {recent.length ? (
            <Table className="-m-5 w-[calc(100%+2.5rem)] max-w-none border-0 bg-transparent">
              <thead>
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Wilaya</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="hover:bg-white/[0.02]">
                    <td className={`${td} whitespace-nowrap`}>
                      <Link href={`/admin/orders/${o.id}`} className="font-medium text-king-white hover:text-king-bright-red">{o.number}</Link>
                    </td>
                    <td className={td}>{o.customerName}</td>
                    <td className={td}>{o.wilayaName}</td>
                    <td className={td}><Badge status={o.status}>{STATUS_LABELS[o.status]}</Badge></td>
                    <td className={`${td} text-right whitespace-nowrap text-white`}>{formatDA(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-king-gray">No orders yet.</p>
          )}
        </Panel>

        <Panel title="Low stock" actions={<Link href="/admin/inventory?filter=low" className="text-xs font-medium text-king-gray hover:text-king-white">Inventory</Link>}>
          {low.length ? (
            <ul className="space-y-3">
              {low.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/admin/products/${v.productId}`} className="min-w-0 truncate text-king-muted hover:text-king-white">
                    {v.productName} <span className="text-king-gray">· {v.color} / {v.size}</span>
                  </Link>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-king-bright-red">
                    <AlertTriangle className="size-3" aria-hidden />
                    {v.available <= 0 ? "Out" : `Low — ${v.available} left`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-king-gray">Every variant is above its threshold.</p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Most viewed">
          <RankList items={a.mostViewed.map((p) => ({ label: p.name, value: p.value }))} empty="No product views yet." />
        </Panel>
        <Panel title="Most added to bag">
          <RankList items={a.mostAdded.map((p) => ({ label: p.name, value: p.value }))} empty="Nothing added to bags yet." />
        </Panel>
        <Panel title="Most purchased">
          <RankList items={a.mostPurchased.map((p) => ({ label: p.name, value: p.value }))} empty="No sales yet." />
        </Panel>
        <Panel title="Top wilayas">
          <RankList items={a.topWilayas.map((w) => ({ label: `${w.name} · ${w.orders} order(s)`, value: w.revenue }))} format={formatDA} empty="No orders yet." />
        </Panel>
      </div>
    </div>
  )
}

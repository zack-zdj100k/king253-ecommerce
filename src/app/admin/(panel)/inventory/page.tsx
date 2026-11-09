import type { Metadata } from "next"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { db } from "@/server/db"
import { listInventory } from "@/server/admin/queries"
import { getSetting } from "@/server/settings"
import { listStores } from "@/server/stores"
import { StockAdjust } from "@/components/admin/product/stock-adjust"
import { deleteInventoryVariantAction } from "@/app/admin/actions/products"
import { DeleteButton } from "@/components/admin/delete-button"
import { Empty, PageHeader, Table, inputClass, td, th, pill } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Inventory" }

const FILTERS = [
  ["instock", "In stock"],
  ["low", "Low stock"],
  ["out", "Out of stock"],
  ["reserved", "Has reservations"],
] as const

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const p = await searchParams
  const one = (v: unknown) => (typeof v === "string" ? v : undefined)
  const [threshold, shops] = await Promise.all([getSetting(db, "lowStockThreshold"), listStores(db, { activeOnly: true })])
  const wantedShop = Number(one(p.shop))
  const shop = shops.find((s) => s.id === wantedShop) ?? shops[0]
  const filter = FILTERS.some(([k]) => k === one(p.filter)) ? one(p.filter)! : "instock"
  const f = { q: one(p.q), filter, page: Number(one(p.page)) || 1 }
  const href = (patch: Record<string, string | number>) =>
    `/admin/inventory?${new URLSearchParams({ shop: String(shop?.id ?? ""), filter: f.filter, ...(f.q ? { q: f.q } : {}), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) })}`
  if (!shop) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Stock" title="Inventory" />
        <Empty>No active shop yet. Add one in Admin → Shops.</Empty>
      </div>
    )
  }
  const { rows, total, page, pages } = await listInventory(db, { ...f, storeId: shop.id, threshold })

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Stock" title="Inventory">
        <p className="mt-2 max-w-2xl text-sm text-king-gray">
          Each shop has its own stock. Available = physical − reserved. Orders reserve stock in their departure shop; delivery removes it from
          physical; cancellation only releases the reservation. Default low-stock alert: {threshold} (change it in Settings or per variant).
        </p>
      </PageHeader>

      <nav aria-label="Shop" className="flex flex-wrap items-center gap-2">
        {shops.map((s) => (
          <Link key={s.id} href={href({ shop: s.id, page: 1 })} className={pill(s.id === shop.id)}>
            {s.name}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={href({ filter: k, page: 1 })} className={pill(f.filter === k)}>
            {label}
          </Link>
        ))}
        <form action="/admin/inventory" className="ml-auto flex gap-2">
          <input type="hidden" name="shop" value={shop.id} />
          <input type="hidden" name="filter" value={f.filter} />
          <input name="q" defaultValue={f.q} placeholder="Product, SKU or barcode" aria-label="Search inventory" className={`${inputClass} w-64`} />
        </form>
      </div>
      <p className="text-xs text-king-gray">
        {total} variant(s) in {shop.name}
      </p>

      {rows.length === 0 ? (
        <Empty>Nothing here.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Product · variant</th>
              <th className={th}>SKU</th>
              <th className={`${th} text-right`}>Physical</th>
              <th className={`${th} text-right`}>Reserved</th>
              <th className={`${th} text-right`}>Available</th>
              <th className={`${th} text-right`}>All shops</th>
              <th className={th}>History</th>
              <th className={th}><span className="sr-only">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const available = r.physical - r.reserved
              const low = available > 0 && available <= r.threshold
              return (
                <tr key={r.id} className="align-top hover:bg-white/[0.02]">
                  <td className={td}>
                    <Link href={`/admin/products/${r.productId}`} className="text-king-white hover:text-king-bright-red">{r.productName}</Link>
                    <span className="block text-xs">{r.color} / {r.size}{r.productStatus !== "published" ? ` · ${r.productStatus}` : ""}</span>
                  </td>
                  <td className={`${td} font-mono text-xs`}>{r.sku}{r.barcode ? <span className="block text-king-gray">{r.barcode}</span> : null}</td>
                  <td className={`${td} text-right tabular-nums text-king-white`}>
                    {r.physical}
                    <StockAdjust variantId={r.id} storeId={shop.id} physical={r.physical} reserved={r.reserved} />
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{r.reserved}</td>
                  <td className={cn(td, "text-right font-semibold tabular-nums", available <= 0 ? "text-king-gray" : low ? "text-king-bright-red" : "text-king-white")}>
                    {available <= 0 ? "Out of stock" : available}
                    {low && <span className="block text-xs font-medium">Low stock — {available} left</span>}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{Math.max(0, r.totalPhysical - r.totalReserved)}</td>
                  <td className={td}>
                    <Link href={`/admin/inventory/${r.id}`} className="text-xs font-medium text-king-gray hover:text-king-white">Ledger</Link>
                  </td>
                  <td className={`${td} w-px text-right`}>
                    <DeleteButton compact label={`Delete ${r.sku}`} confirm="Delete variant?" action={deleteInventoryVariantAction.bind(null, r.id)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: n })} className={pill(n === page)}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

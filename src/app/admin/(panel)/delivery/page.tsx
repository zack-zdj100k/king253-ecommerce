import type { Metadata } from "next"
import Link from "next/link"
import { asc } from "drizzle-orm"

import { db } from "@/server/db"
import { wilayas } from "@/server/db/schema"
import { listDesks, listRates } from "@/server/shipping"
import { listStores } from "@/server/stores"
import { DeliveryImport, DeskEditor, RatesEditor } from "@/components/admin/delivery-editors"
import { Empty, PageHeader, Panel, pill } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Delivery" }

export default async function DeliveryPage({ searchParams }: PageProps<"/admin/delivery">) {
  const p = await searchParams
  const shops = await listStores(db, { activeOnly: true })
  const shop = shops.find((s) => String(s.id) === p.shop) ?? shops[0]
  if (!shop) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Sales" title="Delivery" />
        <Empty>No active shop yet. Add one in Admin → Shops.</Empty>
      </div>
    )
  }
  const [rates, desks, wl] = await Promise.all([
    listRates(db, shop.id),
    listDesks(db, shop.id),
    db.select({ code: wilayas.code, nameFr: wilayas.nameFr }).from(wilayas).orderBy(asc(wilayas.code)),
  ])
  const priced = rates.filter((r) => r.homePrice !== null).length

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Sales" title="Delivery">
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          Courier prices depend on the shop the parcel leaves from. At checkout the customer sees every shop that has the whole order, with its
          price for their wilaya and delivery type, and the cheapest is pre-selected.
        </p>
      </PageHeader>

      <nav aria-label="Shop" className="flex flex-wrap gap-2">
        {shops.map((s) => (
          <Link key={s.id} href={`/admin/delivery?shop=${s.id}`} className={pill(s.id === shop.id)}>
            {s.name}
          </Link>
        ))}
      </nav>

      <Panel title={`Import price lists (all shops)`}>
        <p className="mb-4 max-w-3xl text-sm text-king-gray">
          CSV made from the couriers&apos; PDF lists. Prices: <code className="text-king-white">shop,wilaya,home_price,desk_price</code> · Desks:{" "}
          <code className="text-king-white">shop,wilaya,commune,name,address,desk_price</code>. <code className="text-king-white">shop</code> is the
          short code from Shops ({shops.map((s) => s.slug).join(", ")}). Existing rows are updated, nothing is deleted; any wrong line stops the import.
        </p>
        <DeliveryImport />
      </Panel>

      <Panel title={`${shop.name} — prices per wilaya (${priced}/${rates.length} with a home price)`}>
        <RatesEditor key={shop.id} storeId={shop.id} rows={rates} />
      </Panel>

      <Panel title={`${shop.name} — stop desks (${desks.length})`}>
        <div className="space-y-5">
          {desks.length === 0 ? (
            <p className="text-sm text-king-gray">No desks yet — customers can only choose home delivery from this shop.</p>
          ) : (
            <ul className="space-y-4 divide-y divide-white/5">
              {desks.map((d) => (
                <li key={d.id} className="pt-4 first:pt-0">
                  <DeskEditor storeId={shop.id} desk={d} wilayas={wl} />
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-2xl border border-dashed border-white/15 p-4">
            <p className="mb-3 text-xs font-medium text-king-white">Add a desk</p>
            <DeskEditor key={`new-${shop.id}`} storeId={shop.id} desk={null} wilayas={wl} />
          </div>
        </div>
      </Panel>
    </div>
  )
}

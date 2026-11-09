import type { Metadata } from "next"

import { db } from "@/server/db"
import { listStores } from "@/server/stores"
import { StoreEditor } from "@/components/admin/site-editors"
import { Empty, PageHeader, Panel } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Shops" }

export default async function ShopsPage() {
  const stores = await listStores(db)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Site" title="Shops">
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          Every active shop holds its own stock, ships orders, has its own delivery prices and receives its own new-order emails. A shop you add
          here appears automatically in products, checkout, delivery prices and statistics. Untick “Active” to stop using a shop without losing
          its history.
        </p>
      </PageHeader>

      {stores.length === 0 ? (
        <Empty>No shops yet. Add your first shop below.</Empty>
      ) : (
        <div className="space-y-6">
          {stores.map((store) => (
            <Panel key={store.id} title={`${store.name}${store.active ? (store.listed ? "" : " · not on Location page") : " · inactive"}`}>
              <StoreEditor store={store} />
            </Panel>
          ))}
        </div>
      )}

      <Panel title="Add a shop">
        <StoreEditor store={null} />
      </Panel>
    </div>
  )
}

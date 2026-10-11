import type { Metadata } from "next"

import { db } from "@/server/db"
import { listStores } from "@/server/stores"
import { StoreEditor } from "@/components/admin/site-editors"
import { Empty, PageHeader, Panel } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Locations" }

export default async function LocationsPage() {
  const stores = await listStores(db)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Shops" title="Locations">
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          The KING 253 shops listed on the public Location page. Visitors can find the shop closest to them. Delivery works everywhere in Algeria —
          the delivery fee is in Settings.
        </p>
      </PageHeader>

      {stores.length === 0 ? (
        <Empty>No shops yet. Add your first shop below.</Empty>
      ) : (
        <div className="space-y-6">
          {stores.map((store) => (
            <Panel key={store.id} title={`${store.name}${store.active ? "" : " · hidden"}`}>
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

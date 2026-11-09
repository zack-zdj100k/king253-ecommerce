"use client"

import * as React from "react"

import { saveProductStoresAction } from "@/app/admin/actions/products"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnOutline } from "@/components/admin/ui"

type Shop = { id: number; name: string; active: boolean }

/**
 * Shops that sell this product. Each ticked shop gets its own stock per size
 * below. A shop can only be unticked once its stock of this product is 0.
 */
export function ProductShops({ productId, shops, selected }: { productId: string; shops: Shop[]; selected: number[] }) {
  const { run, pending, feedback } = useAdminAction()
  const [ids, setIds] = React.useState(selected)
  const dirty = ids.length !== selected.length || ids.some((id) => !selected.includes(id))
  const visible = shops.filter((s) => s.active || selected.includes(s.id))

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveProductStoresAction(productId, ids))
      }}
    >
      <div className="flex flex-wrap gap-2">
        {visible.map((shop) => {
          const on = ids.includes(shop.id)
          return (
            <label
              key={shop.id}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                on ? "border-king-bright-red/60 bg-king-red/15 text-king-white" : "border-white/10 text-king-muted hover:border-white/25"
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => setIds(e.target.checked ? [...ids, shop.id] : ids.filter((id) => id !== shop.id))}
                className="accent-[#a30d0d]"
              />
              {shop.name}
              {!shop.active && <span className="text-xs text-king-gray">(inactive)</span>}
            </label>
          )
        })}
        {visible.length === 0 && <p className="text-sm text-king-gray">No shops yet — add one in Admin → Shops.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!dirty || pending} className={btnOutline}>
          Save shops
        </button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

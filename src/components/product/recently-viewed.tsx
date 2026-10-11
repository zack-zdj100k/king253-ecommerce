"use client"

import * as React from "react"

import { getCardsBySlugsAction } from "@/app/actions/shop"
import type { ProductCardData } from "@/server/catalog"
import { useShop } from "@/components/providers/shop-provider"
import { ProductCard } from "@/components/shop/product-card"

/** Recently viewed pieces (stored locally, max 12), excluding the current one. */
export function RecentlyViewed({ exclude, title = "Recently viewed" }: { exclude?: string; title?: string }) {
  const { recentlyViewed } = useShop()
  const [cards, setCards] = React.useState<ProductCardData[]>([])
  const slugs = React.useMemo(() => recentlyViewed.filter((s) => s !== exclude).slice(0, 4), [recentlyViewed, exclude])
  const key = slugs.join(",")

  React.useEffect(() => {
    if (!key) return
    let alive = true
    getCardsBySlugsAction(key.split(",")).then((c) => alive && setCards(c))
    return () => {
      alive = false
    }
  }, [key])

  const visible = key ? cards : []
  if (!visible.length) return null
  return (
    <section aria-labelledby="recent-title" className="border-t border-white/10 pt-16">
      <h2 id="recent-title" className="king-display text-[clamp(2rem,3.5vw,3.25rem)] text-king-white">
        {title}
      </h2>
      <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 lg:grid-cols-4">
        {visible.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} sizes={[50, 50, 25]} />
        ))}
      </div>
    </section>
  )
}

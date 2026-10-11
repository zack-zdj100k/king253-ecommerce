"use client"

import * as React from "react"
import Link from "next/link"

import { getCardsByIdsAction } from "@/app/actions/shop"
import type { ProductCardData } from "@/server/catalog"
import { Button } from "@/components/ui/button"
import { useShop } from "@/components/providers/shop-provider"
import { ProductCard } from "@/components/shop/product-card"
import { RecentlyViewed } from "@/components/product/recently-viewed"

export function WishlistView() {
  const { wishlist } = useShop()
  const [cards, setCards] = React.useState<ProductCardData[] | null>(null)
  const key = wishlist.join(",")

  React.useEffect(() => {
    let alive = true
    if (!key) return
    getCardsByIdsAction(key.split(",")).then((c) => alive && setCards(c))
    return () => {
      alive = false
    }
  }, [key])

  const visible = key ? (cards ?? []).filter((c) => wishlist.includes(c.id)) : []

  return (
    <div className="space-y-24">
      {!key ? (
        <div className="py-16">
          <p className="king-display text-5xl text-king-white md:text-7xl">Nothing saved yet.</p>
          <p className="mt-4 text-sm text-king-gray">Tap the heart on any piece to keep it here.</p>
          <Button asChild variant="king" size="xl" className="mt-10">
            <Link href="/clothes">Shop the collection</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 md:gap-y-14 lg:grid-cols-4">
          {visible.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} sizes={[50, 50, 25]} />
          ))}
          {cards && visible.length === 0 && <p className="col-span-full text-sm text-king-gray">Saved pieces are no longer available.</p>}
        </div>
      )}
      <RecentlyViewed />
    </div>
  )
}

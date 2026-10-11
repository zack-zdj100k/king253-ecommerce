"use client"

import * as React from "react"
import Link from "next/link"
import { Eye, Plus } from "lucide-react"

import { formatDA } from "@/lib/money"
import type { ProductCardData } from "@/server/catalog"
import CardFanCarousel, { type CardItem } from "@/components/ui/card-fan-carousel"
import { useShop } from "@/components/providers/shop-provider"
import { productSizes } from "@/components/shop/product-image"

const FALLBACK = { url: "/images/backgrounds/home-background.jpg", focusX: 50, focusY: 50, zoom: 1 }

export function LatestDropFan({ products }: { products: ProductCardData[] }) {
  const { setQuickView } = useShop()
  const [center, setCenter] = React.useState(0)

  // Stable array: the fan re-runs its layout whenever `cards` changes.
  const cards = React.useMemo<CardItem[]>(
    () =>
      products.map((p) => {
        const image = p.image ?? FALLBACK
        return {
          imgUrl: image.url,
          focus: { x: image.focusX, y: image.focusY },
          zoom: image.zoom,
          sizes: productSizes(image, [40, 26, 19]),
          alt: p.name,
          title: p.name,
          meta: `${p.categoryName ?? ""} · ${p.available > 0 ? formatDA(p.price) : "Out of stock"}`,
          onSelect: () => setQuickView(p.slug),
        }
      }),
    [products, setQuickView]
  )

  const current = products[center]
  if (!products.length) return null

  return (
    <div className="overflow-x-clip">
      <CardFanCarousel cards={cards} label="The latest drop" onCenterChange={setCenter} />

      {current && (
        <div
          key={current.id}
          className="mx-auto mt-10 flex max-w-xl animate-in flex-col items-center gap-5 text-center duration-500 fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
        >
          <div>
            <p className="king-label text-[0.6rem] text-king-bright-red">
              {String(center + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")} — {current.categoryName}
            </p>
            <p className="king-display mt-3 text-3xl text-king-white md:text-4xl">{current.name}</p>
            <p className="king-label mt-2 text-[0.6rem] text-king-gray">
              {formatDA(current.price)}
              {current.compareAt ? <span className="ml-2 line-through">{formatDA(current.compareAt)}</span> : null}
              {current.available <= 0 ? " · Out of stock" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/product/${current.slug}`}
              className="king-label inline-flex h-11 items-center gap-2 border border-white/15 px-5 text-[0.625rem] text-king-white transition-colors hover:border-king-white"
            >
              <Eye className="size-3.5" aria-hidden /> View piece
            </Link>
            <button
              type="button"
              disabled={current.available <= 0}
              onClick={() => setQuickView(current.slug)}
              className="king-label inline-flex h-11 items-center gap-2 bg-king-red px-5 text-[0.625rem] text-king-white transition-colors hover:bg-king-bright-red disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-3.5" aria-hidden /> {current.available <= 0 ? "Out of stock" : "Choose size"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

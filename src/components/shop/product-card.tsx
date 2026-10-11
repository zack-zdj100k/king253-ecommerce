"use client"

import Link from "next/link"
import { Heart } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import type { ProductCardData } from "@/server/catalog"
import { useShop } from "@/components/providers/shop-provider"
import { productSizes } from "@/components/shop/product-image"
import { promoBarText } from "@/components/shop/stock"
import { InteractiveCard } from "@/components/ui/3d-card"

export function ProductCard({
  product,
  index,
  sizes = [50, 50, 25],
  className,
}: {
  product: ProductCardData
  index: number
  /** Card width in vw at [mobile, tablet, desktop]. */
  sizes?: [number, number, number]
  className?: string
}) {
  const { toggleWishlist, wishlist } = useShop()
  const saved = wishlist.includes(product.id)
  const soldOut = product.available <= 0
  const image = product.image ?? { url: "/images/backgrounds/home-background.jpg", focusX: 50, focusY: 50, zoom: 1 }

  return (
    <article className={cn("group", className)}>
      <InteractiveCard
        className="aspect-[4/5]"
        imageUrl={image.url}
        imageAlt={image.alt ?? product.name}
        focus={{ x: image.focusX, y: image.focusY }}
        zoom={image.zoom}
        sizes={productSizes(image, sizes)}
        subtitle={product.categoryName ?? undefined}
        href={`/product/${product.slug}`}
        arrowLabel={`View ${product.name}`}
        actionText={soldOut ? "Out of stock" : "View details"}
        actionDisabled={soldOut}
        linkWholeCard
        promo={promoBarText(product)}
        topSlot={
          <div className="-mt-1 -ml-1 flex items-center gap-1">
            <span className="king-label px-1 text-[0.55rem] text-king-muted">{String(index + 1).padStart(2, "0")}</span>
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-pressed={saved}
              aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
              className="grid size-8 place-items-center text-king-white/80 transition-colors hover:text-king-white"
            >
              <Heart className={cn("size-3.5 transition-all duration-300", saved && "scale-110 fill-king-bright-red text-king-bright-red")} />
            </button>
          </div>
        }
      />

      {/* Spec line — FRZN style */}
      <Link href={`/product/${product.slug}`} className="mt-3 block space-y-1.5 md:mt-4">
        <h3 className="text-[0.75rem] leading-snug font-semibold tracking-tight text-king-white uppercase transition-colors duration-300 group-hover:text-king-bright-red md:text-[0.8rem]">
          {product.name}
        </h3>
        {product.colours.length > 0 && (
          <p className="king-label flex items-center gap-2 text-[0.55rem] text-king-gray">
            <span className="flex -space-x-0.5" aria-hidden>
              {product.colours.slice(0, 4).map((c) => (
                <span key={c.name} className="size-2 rounded-full ring-1 ring-white/25" style={{ backgroundColor: c.hex ?? "#555" }} />
              ))}
            </span>
            {product.colours.length === 1 ? product.colours[0].name : `${product.colours.length} colours`}
          </p>
        )}
        <p className="king-label flex items-center gap-2 text-[0.6rem] text-king-muted">
          {formatDA(product.price)}
          {product.compareAt ? <span className="text-king-gray line-through">{formatDA(product.compareAt)}</span> : null}
          {!product.compareAt && product.promo && <span className="text-king-bright-red">· Colours on promo</span>}
          {soldOut && <span className="text-king-gray">· Out of stock</span>}
        </p>
      </Link>
    </article>
  )
}

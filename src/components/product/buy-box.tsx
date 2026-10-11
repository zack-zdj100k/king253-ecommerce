"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Heart, Loader2, Minus, Plus, Truck } from "lucide-react"

import { cn } from "@/lib/utils"
import { trackViewAction } from "@/app/actions/shop"
import { Button } from "@/components/ui/button"
import { useShop } from "@/components/providers/shop-provider"
import { AvailabilityLabel, PriceTag, PromoBadge } from "@/components/shop/stock"
import type { Crop } from "@/components/shop/product-image"
import { useProductSelection, useVariantSelection, VariantPicker, type VariantSelection } from "@/components/shop/variant-picker"

type Variant = { id: string; size: string; color: string; colorHex: string | null; price: number | null; compareAt: number | null; available: number }

export function BuyBox({
  product,
  variants,
  colourImages,
  signedIn,
}: {
  /** The product price (and regular price when on promo) — shown until a colour decides otherwise. */
  product: { id: string; slug: string; name: string; price: number | null; compareAt: number | null }
  variants: Variant[]
  colourImages?: Record<string, Crop | null>
  /** Signed-out visitors are sent to create an account before buying. */
  signedIn: boolean
}) {
  const router = useRouter()
  const { addToCart, wishlist, toggleWishlist, pushRecentlyViewed } = useShop()
  // Shared with the gallery when rendered inside ProductSelectionProvider.
  const own = useVariantSelection(variants)
  const selection = (useProductSelection() as VariantSelection<Variant> | null) ?? own
  const variant = selection.variant
  const [quantity, setQuantity] = React.useState(1)
  const [busy, setBusy] = React.useState<"add" | "buy" | null>(null)
  const saved = wishlist.includes(product.id)
  const totalAvailable = variants.reduce((s, v) => s + v.available, 0)
  const soldOut = totalAvailable <= 0
  const maxQty = Math.min(variant?.available ?? 1, 20)
  const qty = Math.min(quantity, Math.max(1, maxQty))

  React.useEffect(() => {
    trackViewAction(product.id)
    pushRecentlyViewed(product.slug)
  }, [product.id, product.slug, pushRecentlyViewed])

  // Size chosen → its price; colour chosen → that colour's price; otherwise the product price.
  const shownPrice = variant?.price ?? selection.colourPrice ?? product.price
  const shownCompareAt = variant ? variant.compareAt : selection.colourPrice !== null ? selection.colourCompareAt : product.compareAt
  const canBuy = !!variant && variant.available > 0
  // Buttons always say what they do; without a size they ask for one instead of going dead.
  const label = soldOut || (variant && variant.available <= 0) ? "Out of stock" : null
  const [needSize, setNeedSize] = React.useState(false)
  const pickerRef = React.useRef<HTMLDivElement>(null)
  const askForSize = () => {
    setNeedSize(true)
    pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }
  React.useEffect(() => {
    if (variant) setNeedSize(false) // eslint-disable-line react-hooks/set-state-in-effect -- clear the hint once a size is picked
  }, [variant])

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <PriceTag price={shownPrice} compareAt={shownCompareAt} className="text-2xl font-medium tracking-tight text-king-white" />
        <PromoBadge price={shownPrice} compareAt={shownCompareAt} />
      </div>

      {variants.length ? (
        <div ref={pickerRef} className={cn("scroll-mt-28 transition-colors", needSize && "rounded-sm ring-1 ring-king-bright-red ring-offset-8 ring-offset-king-black")}>
          <VariantPicker variants={variants} selection={selection} colourImages={colourImages} />
          {needSize && (
            <p role="alert" className="mt-3 text-sm text-king-bright-red">
              Choose your size first.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-king-gray">Sizes are coming soon.</p>
      )}

      <AvailabilityLabel available={variant ? variant.available : totalAvailable} />

      {canBuy && (
        <div className="flex items-center gap-4">
          <span className="king-label text-[0.6rem] text-king-gray">Quantity</span>
          <div className="flex items-center border border-white/15">
            <button type="button" onClick={() => setQuantity(Math.max(1, qty - 1))} aria-label="Decrease quantity" className="grid size-10 place-items-center text-king-muted hover:text-king-white">
              <Minus className="size-3.5" />
            </button>
            <span className="w-10 text-center text-sm tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(Math.min(maxQty, qty + 1))}
              disabled={qty >= maxQty}
              aria-label="Increase quantity"
              className="grid size-10 place-items-center text-king-muted hover:text-king-white disabled:opacity-30"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Button
          variant="king"
          size="xl"
          className="w-full"
          disabled={!!label || busy !== null}
          onClick={() => {
            if (!variant) return askForSize()
            if (!signedIn) {
              // Ordering needs an account: create one, then come back to this page.
              router.push(`/sign-up?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
              return
            }
            setBusy("buy")
            router.push(`/checkout?buy=${variant.id}&qty=${qty}`)
          }}
        >
          {busy === "buy" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {label ?? "Buy now"}
        </Button>
        <div className="flex gap-3">
          <Button
            variant="kingOutline"
            size="xl"
            className="flex-1"
            disabled={!!label || busy !== null}
            onClick={async () => {
              if (!variant) return askForSize()
              setBusy("add")
              await addToCart(variant.id, qty)
              setBusy(null)
            }}
          >
            {busy === "add" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {label ?? "Add to bag"}
          </Button>
          <Button
            variant="kingOutline"
            size="xl"
            className="w-12 px-0 md:w-14 md:px-0"
            onClick={() => toggleWishlist(product.id)}
            aria-pressed={saved}
            aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
          >
            <Heart className={cn("size-4", saved && "fill-king-bright-red text-king-bright-red")} />
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-3 border-t border-white/10 pt-5 text-sm text-king-gray">
        <Truck className="mt-0.5 size-4 shrink-0 text-king-bright-red" aria-hidden />
        Cash on delivery everywhere in Algeria. The delivery fee is shown at checkout.
      </p>
    </div>
  )
}

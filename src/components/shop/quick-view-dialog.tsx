"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { getQuickViewAction, type QuickViewData } from "@/app/actions/shop"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useShop } from "@/components/providers/shop-provider"
import { ProductImage, productSizes } from "@/components/shop/product-image"
import { AvailabilityLabel, PriceTag, PromoBadge } from "@/components/shop/stock"
import { imagesForColour, useVariantSelection, VariantPicker } from "@/components/shop/variant-picker"

export function QuickViewDialog() {
  const { quickView: slug, setQuickView } = useShop()
  const [data, setData] = React.useState<QuickViewData | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!slug) return
    let alive = true
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch below */
    setLoading(true)
    getQuickViewAction(slug)
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [slug])

  const open = slug !== null
  return (
    <Dialog open={open} onOpenChange={(o) => !o && setQuickView(null)}>
      <DialogContent className="max-h-[92svh] w-[calc(100%-2rem)] max-w-5xl gap-0 overflow-y-auto border-white/10 bg-king-near-black p-0 sm:max-w-5xl" data-lenis-prevent>
        {loading || !data || data.slug !== slug ? (
          <div className="grid min-h-80 place-items-center">
            <DialogTitle className="sr-only">Loading product</DialogTitle>
            <DialogDescription className="sr-only">Loading product details</DialogDescription>
            {loading ? <Loader2 className="size-6 animate-spin text-king-gray" aria-hidden /> : <p className="text-sm text-king-gray">This product is no longer available.</p>}
          </div>
        ) : (
          <QuickViewBody key={data.id} data={data} onClose={() => setQuickView(null)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function QuickViewBody({ data, onClose }: { data: QuickViewData; onClose: () => void }) {
  const { addToCart, wishlist, toggleWishlist } = useShop()
  const router = useRouter()
  const selection = useVariantSelection(data.variants)
  const [busy, setBusy] = React.useState(false)
  const [needSize, setNeedSize] = React.useState(false)
  const variant = selection.variant
  const saved = wishlist.includes(data.id)
  const totalAvailable = data.variants.reduce((s, v) => s + v.available, 0)
  const price = variant?.price ?? selection.colourPrice ?? data.price
  const compareAt = variant ? variant.compareAt : selection.colourPrice !== null ? selection.colourCompareAt : data.compareAt
  const colourImages = Object.fromEntries(selection.colours.map((c) => [c.name, data.images.find((i) => i.color === c.name) ?? null]))
  const photos = imagesForColour(data.images, selection.colour)

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="md:sticky md:top-0 md:self-start">
        <ColourPhotos key={selection.colour ?? "all"} photos={photos} name={data.name} colour={selection.colour} />
      </div>
      <div className="flex flex-col gap-5 p-6 md:p-10">
        {data.categoryName && <p className="king-label text-king-bright-red">{data.categoryName}</p>}
        <DialogTitle className="king-display text-4xl text-king-white md:text-5xl">{data.name}</DialogTitle>
        <div className="flex flex-wrap items-center gap-3">
          <PriceTag price={price} compareAt={compareAt} className="king-label text-king-muted" />
          <PromoBadge price={price} compareAt={compareAt} />
        </div>
        {data.shortDescription ? (
          <DialogDescription className="text-sm leading-relaxed text-king-muted">{data.shortDescription}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{data.name} — choose a colour and a size.</DialogDescription>
        )}

        {data.variants.length > 0 ? (
          <VariantPicker variants={data.variants} selection={selection} colourImages={colourImages} compact />
        ) : (
          <p className="text-sm text-king-gray">Sizes coming soon.</p>
        )}
        <AvailabilityLabel available={variant ? variant.available : totalAvailable} />

        <div className="space-y-3">
          <div className="flex gap-3">
            <Button
              variant="king"
              size="xl"
              className="flex-1"
              disabled={(!!variant && variant.available <= 0) || busy}
              onClick={async () => {
                if (!variant) return setNeedSize(true)
                setBusy(true)
                const r = await addToCart(variant.id, 1)
                setBusy(false)
                if (r.ok) onClose()
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {variant && variant.available <= 0 ? "Out of stock" : "Add to bag"}
            </Button>
            <Button
              variant="kingOutline"
              size="xl"
              className="w-12 px-0 md:w-14 md:px-0"
              onClick={() => toggleWishlist(data.id)}
              aria-pressed={saved}
              aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
            >
              <Heart className={cn("size-4", saved && "fill-king-bright-red text-king-bright-red")} />
            </Button>
          </div>
          <Button
            variant="kingOutline"
            size="xl"
            className="w-full"
            disabled={!!variant && variant.available <= 0}
            onClick={() => {
              if (!variant) return setNeedSize(true)
              onClose()
              // Ordering needs an account: create one, then come back to this page.
              if (!data.signedIn) router.push(`/sign-up?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
              else router.push(`/checkout?buy=${variant.id}&qty=1`)
            }}
          >
            {variant && variant.available <= 0 ? "Out of stock" : "Buy now"}
          </Button>
          {needSize && !variant && (
            <p role="alert" className="text-center text-sm text-king-bright-red">
              Choose your size first.
            </p>
          )}
        </div>

        {data.details.length > 0 && (
          <div className="divide-y divide-white/10 border-y border-white/10">
            {data.details.map((d, i) => (
              <details key={d.title} open={i === 0} className="group py-4">
                <summary className="king-label flex cursor-pointer list-none items-center justify-between text-[0.6rem] text-king-white">
                  {d.title}
                  <span aria-hidden className="text-king-bright-red transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-king-muted">{d.body}</p>
              </details>
            ))}
          </div>
        )}

        <Link
          href={`/product/${data.slug}${selection.colour ? `?colour=${encodeURIComponent(selection.colour)}` : ""}`}
          onClick={onClose}
          className="king-label block text-center text-[0.6rem] text-king-muted underline-offset-4 hover:text-king-white hover:underline"
        >
          Open the product page · reviews
        </Link>
      </div>
    </div>
  )
}

/** The chosen colour's photos: big frame + thumbnails. */
function ColourPhotos({ photos, name, colour }: { photos: QuickViewData["images"]; name: string; colour: string | null }) {
  const [active, setActive] = React.useState(0)
  const main = photos[active] ?? null
  return (
    <div className="animate-in duration-300 fade-in-0 motion-reduce:animate-none">
      <div className="relative aspect-[4/5] overflow-hidden bg-king-card">
        <ProductImage image={main} alt={main?.alt ?? (colour ? `${name} — ${colour}` : name)} sizes={productSizes(main, [100, 50, 40])} />
        {colour && (
          <span className="king-label absolute bottom-3 left-3 bg-black/60 px-3 py-1.5 text-[0.55rem] text-king-white backdrop-blur">{colour}</span>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((p, i) => (
            <button
              key={`${p.url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Photo ${i + 1} of ${photos.length}`}
              aria-current={i === active}
              className={cn("relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-king-card transition-opacity", i === active ? "ring-1 ring-king-bright-red" : "opacity-55 hover:opacity-100")}
            >
              <ProductImage image={p} alt="" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

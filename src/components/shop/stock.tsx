import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"

/** Below this many units we show "N left". */
export const LOW_STOCK_DISPLAY = 5

export function AvailabilityLabel({ available, className }: { available: number; className?: string }) {
  const out = available <= 0
  return (
    <p className={cn("king-label flex items-center gap-2 text-[0.6rem]", out ? "text-king-gray" : "text-king-muted", className)} aria-live="polite">
      <span className={cn("size-1.5 rounded-full", out ? "bg-king-gray" : available <= LOW_STOCK_DISPLAY ? "bg-king-bright-red" : "bg-king-white/70")} aria-hidden />
      {out ? "Out of stock" : available <= LOW_STOCK_DISPLAY ? `Available — ${available} left` : "Available"}
    </p>
  )
}

/** "−20%" pill shown next to a promo price. */
export function PromoBadge({ price, compareAt, className }: { price: number | null; compareAt: number | null | undefined; className?: string }) {
  if (price === null || !compareAt || price >= compareAt) return null
  const off = Math.round(((compareAt - price) / compareAt) * 100)
  return (
    <span className={cn("king-label inline-flex h-6 items-center bg-king-red px-2 text-[0.55rem] text-king-white", className)}>
      Promo{off > 0 ? ` −${off}%` : ""}
    </span>
  )
}

export function PriceTag({ price, compareAt, className }: { price: number | null; compareAt?: number | null; className?: string }) {
  return (
    <p className={cn("flex items-baseline gap-2", className)}>
      <span>{formatDA(price)}</span>
      {compareAt ? <span className="text-[0.8em] text-king-gray line-through">{formatDA(compareAt)}</span> : null}
    </p>
  )
}

/** Text of the red promo bar on product cards, or null when nothing is on promo. */
export function promoBarText(product: { price: number | null; compareAt: number | null; promo: boolean }) {
  if (product.compareAt && product.price !== null && product.price < product.compareAt) {
    return `Promo −${Math.round(((product.compareAt - product.price) / product.compareAt) * 100)}% · was ${formatDA(product.compareAt)}`
  }
  return product.promo ? "Promo on some colours" : null
}

"use client"

import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"

/** Below this many units we show "N left". */
export const LOW_STOCK_DISPLAY = 5

export function AvailabilityLabel({ available, className }: { available: number; className?: string }) {
  const t = useTranslations("stock")
  const out = available <= 0
  return (
    <p className={cn("king-label flex items-center gap-2 text-[0.7rem]", out ? "text-king-gray" : "text-king-muted", className)} aria-live="polite">
      <span className={cn("size-1.5 rounded-full", out ? "bg-king-gray" : available <= LOW_STOCK_DISPLAY ? "bg-king-bright-red" : "bg-king-white/70")} aria-hidden />
      {out ? t("out") : available <= LOW_STOCK_DISPLAY ? t("left", { count: available }) : t("available")}
    </p>
  )
}

/** "−20%" pill shown next to a promo price. */
export function PromoBadge({ price, compareAt, className }: { price: number | null; compareAt: number | null | undefined; className?: string }) {
  const t = useTranslations("stock")
  if (price === null || !compareAt || price >= compareAt) return null
  const off = Math.round(((compareAt - price) / compareAt) * 100)
  return (
    <span className={cn("king-label inline-flex h-6 items-center bg-king-red px-2 text-[0.65rem] text-king-white", className)}>
      {off > 0 ? t("promoOff", { off }) : t("promo")}
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
export function promoBarText(
  product: { price: number | null; compareAt: number | null; promo: boolean },
  t: (key: "promoBar" | "promoSome", values?: Record<string, string | number>) => string
) {
  if (product.compareAt && product.price !== null && product.price < product.compareAt) {
    return t("promoBar", { off: Math.round(((product.compareAt - product.price) / product.compareAt) * 100), price: formatDA(product.compareAt) })
  }
  return product.promo ? t("promoSome") : null
}

"use client"

import Link from "next/link"
import * as React from "react"
import { Heart, LoaderCircle, Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { getQuickViewAction, type QuickViewData } from "@/app/actions/shop"
import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import type { CardImage, ProductCardData } from "@/server/catalog"
import { useShop } from "@/components/providers/shop-provider"
import { ProductImage, productSizes } from "@/components/shop/product-image"

/*
 * Product card — "hang tag + shops" (owner's choice, 2026-11-10).
 * The photo fills the card, a paper tag hangs from the top edge with the price,
 * the name sits big on the photo with stock per shop, colours and a round + button
 * that adds to the bag. The card itself links to the product page, as before.
 * The heart and + are separate buttons above that link, so nothing is nested.
 */

type Shop = ProductCardData["shops"][number]

const LOW = 2
const shortShop = (name: string) => name.replace(/^KING\s*253\s*/i, "").trim() || name
const FALLBACK: CardImage = { url: "/images/backgrounds/home-background.jpg", focusX: 50, focusY: 50, zoom: 1 }

export function ProductCard({
  product,
  index,
  sizes = [50, 50, 25],
  feature = false,
  eyebrow,
  className,
}: {
  product: ProductCardData
  index: number
  /** Card width in vw at [mobile, tablet, desktop]. */
  sizes?: [number, number, number]
  /** Wide campaign card leading the catalog grid. */
  feature?: boolean
  /** Small line above the name (defaults to the category). */
  eyebrow?: string
  className?: string
}) {
  const t = useTranslations("catalog")
  const { toggleWishlist, wishlist } = useShop()
  const saved = wishlist.includes(product.id)
  const inStock = product.shops.filter((s) => s.available > 0)
  const soldOut = product.available <= 0
  const image = product.image ?? FALLBACK
  const label = eyebrow ?? product.categoryName

  return (
    <article
      data-index={index}
      className={cn(
        "group relative isolate overflow-hidden rounded-[18px] bg-king-card ring-1 ring-white/12 md:rounded-[22px]",
        "transition-shadow duration-500 hover:ring-king-bright-red/55 hover:shadow-[0_0_44px_-10px_rgba(212,20,20,0.6)] has-[:focus-visible]:ring-king-bright-red",
        feature ? "aspect-[4/5] sm:aspect-[8/5]" : "aspect-[4/5]",
        className
      )}
    >
      <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-king)] group-hover:scale-[1.04] motion-reduce:transition-none">
        <ProductImage
          image={image}
          alt={image.alt ?? product.name}
          sizes={feature ? "(min-width: 1280px) 40vw, (min-width: 1024px) 50vw, 100vw" : productSizes(image, sizes)}
        />
      </div>
      <Link href={`/product/${product.slug}`} aria-label={t("view", { name: product.name })} className="absolute inset-0 z-[1] focus-visible:outline-none" />

      <HangTag price={product.price} compareAt={product.compareAt} soon={t("priceSoon")} feature={feature} />

      <div className="absolute top-2 right-2 z-10 md:top-3 md:right-3">
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-pressed={saved}
          aria-label={saved ? t("unsave", { name: product.name }) : t("save", { name: product.name })}
          className="grid size-9 place-items-center rounded-full bg-black/35 text-king-white backdrop-blur-md transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-king-bright-red md:size-10"
        >
          <Heart className={cn("size-4 transition-transform duration-300", saved && "scale-110 fill-king-bright-red text-king-bright-red")} aria-hidden />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[62%] bg-gradient-to-t from-black via-black/60 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] space-y-2 p-3 md:space-y-3 md:p-5">
        <div className="pointer-events-none space-y-1.5">
          {label && <p className={cn("king-label text-[0.5rem] text-king-muted md:text-[0.55rem]", !feature && "hidden xl:block")}>{label}</p>}
          <h3
            className={cn(
              "king-display leading-[0.92] text-king-white",
              feature ? "max-w-[85%] text-[clamp(1.6rem,4.6vw,3rem)]" : "text-[1.05rem] [overflow-wrap:anywhere] md:max-w-[85%] md:text-[clamp(1.2rem,1.75vw,1.75rem)]"
            )}
          >
            {product.name}
          </h3>
        </div>

        {soldOut ? (
          <p className="king-label text-[0.5rem] text-king-gray md:text-[0.55rem]">{t("outOfStock")}</p>
        ) : (
          <>
            <div className={cn(feature ? "block" : "hidden md:block")}>
              <ShopChips shops={product.shops} />
            </div>
            {!feature && (
              <ul className="pointer-events-none space-y-0.5 text-[0.65rem] text-king-muted md:hidden" aria-label={t("availableIn")}>
                {inStock.map((s) => (
                  <li key={s.storeId} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className={cn("size-1.5 rounded-full", s.available <= LOW ? "bg-amber-400" : "bg-emerald-400")} aria-hidden />
                    {shortShop(s.name)}
                    {s.available <= LOW ? ` · ${t("shopLeft", { count: s.available })}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="flex items-end justify-between gap-3">
          <p className={cn("pointer-events-none truncate text-xs text-king-muted", !feature && "hidden md:block")}>
            {product.colours.map((c) => c.name).join(" · ")}
          </p>
          <AddToBag product={product} soldOut={soldOut} />
        </div>
      </div>
    </article>
  )
}

/** Paper price tag hanging from the top edge, punched hole and notched bottom. */
function HangTag({ price, compareAt, soon, feature }: { price: number | null; compareAt: number | null; soon: string; feature: boolean }) {
  return (
    <div
      dir="ltr"
      aria-label={price === null ? soon : formatDA(price)}
      className={cn(
        "pointer-events-none absolute top-0 left-[6%] z-[2] flex flex-col items-center bg-[#f2efe9] px-1.5 pt-1.5 pb-3.5 text-[#0b0b0b] shadow-[0_8px_24px_rgba(0,0,0,0.45)] md:px-2 md:pt-2.5 md:pb-5",
        "[clip-path:polygon(0_0,100%_0,100%_100%,50%_86%,0_100%)]",
        feature ? "w-[30%] max-w-36 min-w-24 sm:w-[18%]" : "w-[34%] max-w-32 md:w-[30%] md:min-w-24"
      )}
    >
      <span className="size-1.5 rounded-full bg-[#0b0b0b] md:size-2" aria-hidden />
      <span className="king-label mt-1 text-[0.4rem] text-king-red md:mt-1.5 md:text-[0.5rem]">KING 253</span>
      {price === null ? (
        <span className="mt-1 text-xs font-bold">{soon}</span>
      ) : (
        <>
          <span className="mt-0.5 text-[0.95rem] leading-none font-extrabold tracking-tight whitespace-nowrap tabular-nums md:text-[clamp(1.05rem,2.2vw,1.55rem)]">
            {price.toLocaleString("fr-DZ")}
          </span>
          <span className="king-label text-[0.45rem] md:text-[0.55rem]">DA</span>
          {compareAt ? <span className="mt-0.5 text-[0.5rem] text-[#8a1010] line-through md:text-[0.6rem]">{compareAt.toLocaleString("fr-DZ")}</span> : null}
        </>
      )}
    </div>
  )
}

/** "● Annaba  ● Constantine · 2 left" — green when it can ship, amber when almost gone. */
function ShopChips({ shops }: { shops: Shop[] }) {
  const t = useTranslations("catalog")
  if (!shops.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("availableIn")}>
      {shops.map((s) => {
        const low = s.available > 0 && s.available <= LOW
        return (
          <li
            key={s.storeId}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[0.7rem] font-medium whitespace-nowrap text-king-white backdrop-blur-md",
              s.available <= 0 && "text-king-gray line-through"
            )}
          >
            <span className={cn("size-1.5 rounded-full", s.available <= 0 ? "bg-king-gray" : low ? "bg-amber-400" : "bg-emerald-400")} aria-hidden />
            {shortShop(s.name)}
            {low ? <span className="text-king-muted">· {t("shopLeft", { count: s.available })}</span> : null}
            <span className="sr-only">{s.available <= 0 ? t("stateOut") : low ? t("stateLow") : t("stateIn")}</span>
          </li>
        )
      })}
    </ul>
  )
}

type Variant = QuickViewData["variants"][number]

/**
 * Round + = add to bag. One option in stock → straight into the bag; several →
 * the sizes in stock appear on the card, one tap adds it (the bag then opens).
 */
function AddToBag({ product, soldOut }: { product: ProductCardData; soldOut: boolean }) {
  const t = useTranslations("catalog")
  const { addToCart, notify } = useShop()
  const [options, setOptions] = React.useState<Variant[] | null>(null)
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const panelId = React.useId()

  async function add(id: string) {
    setBusy(id)
    const result = await addToCart(id)
    setBusy(null)
    if (result.ok) setOpen(false)
  }

  async function start() {
    if (open) return setOpen(false)
    let list = options
    if (!list) {
      setBusy("load")
      const data = await getQuickViewAction(product.slug).catch(() => null)
      setBusy(null)
      list = (data?.variants ?? []).filter((v) => v.available > 0)
      setOptions(list)
    }
    if (list.length === 0) return notify(t("outOfStock"), "error")
    if (list.length === 1) return add(list[0].id)
    setOpen(true)
  }

  const oneColour = new Set(options?.map((v) => v.color)).size <= 1

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={soldOut || busy !== null}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={soldOut ? t("soldOutName", { name: product.name }) : t("addToCart", { name: product.name })}
        className="pointer-events-auto relative z-10 ms-auto grid size-10 shrink-0 place-items-center rounded-full bg-king-white text-king-black transition-[background-color,transform] duration-300 hover:scale-105 hover:bg-king-bright-red hover:text-king-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-king-bright-red focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:scale-100 disabled:bg-white/15 disabled:text-king-gray md:size-14"
      >
        {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Plus className={cn("size-5 transition-transform duration-300", open && "rotate-45")} aria-hidden />}
      </button>

      {open && options && (
        <div
          id={panelId}
          role="group"
          aria-label={t("chooseSize", { name: product.name })}
          className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 space-y-2.5 border-t border-white/10 bg-king-black/85 p-3 backdrop-blur-xl md:p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="king-label text-[0.55rem] text-king-muted">{t("sizeTitle")}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="grid size-8 place-items-center rounded-full text-king-white/80 hover:bg-white/10 hover:text-king-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {options.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => add(v.id)}
                  disabled={busy !== null}
                  className="inline-flex h-9 min-w-10 items-center justify-center gap-1.5 rounded-full border border-white/20 px-3 text-xs font-semibold text-king-white transition-colors hover:border-king-bright-red hover:bg-king-bright-red disabled:opacity-60"
                >
                  {busy === v.id && <LoaderCircle className="size-3 animate-spin" aria-hidden />}
                  {oneColour ? v.size : `${v.size} · ${v.color}`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

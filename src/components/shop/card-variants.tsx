"use client"

import Link from "next/link"
import { Heart, Plus, ShoppingBag, Tag } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import type { CardImage, ProductCardData } from "@/server/catalog"
import { useShop } from "@/components/providers/shop-provider"
import { ProductImage, productSizes } from "@/components/shop/product-image"

/*
 * Three product-card directions for /dev/card-preview (owner picks one).
 * Shared rules: the photo fills the whole card (object-cover), the whole card
 * links to the product (stretched link), wishlist and add-to-bag are separate
 * buttons above it, prices in DA, shop availability per shop, out-of-stock state.
 */

export type ShopStock = { storeId: number; name: string; available: number }
export type CardProduct = ProductCardData & { shops: ShopStock[] }

const LOW = 2
const shortShop = (name: string) => name.replace(/^KING\s*253\s*/i, "").trim() || name
const fallback: CardImage = { url: "/images/backgrounds/home-background.jpg", focusX: 50, focusY: 50, zoom: 1 }

function useCard(product: CardProduct) {
  const { toggleWishlist, wishlist, setQuickView } = useShop()
  const saved = wishlist.includes(product.id)
  const inStock = product.shops.filter((s) => s.available > 0)
  return {
    saved,
    soldOut: product.available <= 0 || inStock.length === 0,
    inStock,
    image: product.image ?? fallback,
    wish: () => toggleWishlist(product.id),
    add: () => setQuickView(product.slug),
  }
}

/** The whole card is one link; buttons sit above it (z-10) so nothing is nested in the link. */
function CardLink({ product, className }: { product: CardProduct; className?: string }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      aria-label={product.name}
      className={cn("absolute inset-0 z-[1] focus-visible:outline-none", className)}
    />
  )
}

function Photo({ product, image, sizes }: { product: CardProduct; image: ReturnType<typeof useCard>["image"]; sizes: [number, number, number] }) {
  return (
    <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-king)] group-hover:scale-[1.04] motion-reduce:transition-none">
      <ProductImage image={image} alt={image.alt ?? product.name} sizes={productSizes(image, sizes)} />
    </div>
  )
}

function WishButton({ saved, onClick, name, className }: { saved: boolean; onClick: () => void; name: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      className={cn(
        "relative z-10 grid size-10 place-items-center rounded-full text-king-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-king-bright-red",
        className
      )}
    >
      <Heart className={cn("size-4 transition-transform duration-300", saved && "scale-110 fill-king-bright-red text-king-bright-red")} aria-hidden />
    </button>
  )
}

/** "Annaba · Constantine 2 left" — green when it can ship, amber when almost gone. */
function ShopChips({ shops, tone = "glass" }: { shops: ShopStock[]; tone?: "glass" | "plain" }) {
  if (!shops.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Available in">
      {shops.map((s) => {
        const low = s.available > 0 && s.available <= LOW
        return (
          <li
            key={s.storeId}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium whitespace-nowrap text-king-white",
              tone === "glass" ? "border border-white/15 bg-black/35 backdrop-blur-md" : "border border-white/12 bg-white/[0.06]",
              s.available <= 0 && "text-king-gray line-through"
            )}
          >
            <span className={cn("size-1.5 rounded-full", s.available <= 0 ? "bg-king-gray" : low ? "bg-amber-400" : "bg-emerald-400")} aria-hidden />
            {shortShop(s.name)}
            {low ? <span className="text-king-muted">· {s.available} left</span> : null}
            <span className="sr-only">{s.available <= 0 ? "sold out" : low ? "almost sold out" : "in stock"}</span>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* 1 — Glass overlay                                                  */
/* ------------------------------------------------------------------ */

export function GlassCard({ product, sizes = [50, 50, 25] }: { product: CardProduct; sizes?: [number, number, number] }) {
  const c = useCard(product)
  return (
    <article
      className={cn(
        "group king-chamfer relative isolate aspect-[4/5] overflow-hidden bg-king-card [--cut:16px]",
        "ring-1 ring-white/10 transition-shadow duration-500 hover:ring-king-bright-red/60 hover:shadow-[0_0_40px_-8px_rgba(212,20,20,0.55)] has-[:focus-visible]:ring-king-bright-red"
      )}
    >
      <Photo product={product} image={c.image} sizes={sizes} />
      <CardLink product={product} />
      <div className="absolute top-3 right-3 z-10">
        <WishButton saved={c.saved} onClick={c.wish} name={product.name} className="border border-white/15 bg-black/35 backdrop-blur-md hover:bg-black/55" />
      </div>
      {c.soldOut && (
        <span className="king-label absolute top-4 left-4 z-10 bg-king-black/80 px-2.5 py-1.5 text-[0.55rem] text-king-white">Out of stock</span>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-3/5 bg-gradient-to-t from-black/90 via-black/45 to-transparent" aria-hidden />
      <div className="absolute inset-x-1.5 bottom-1.5 z-[3] space-y-2 border border-white/12 bg-black/30 p-2.5 backdrop-blur-xl [@supports(backdrop-filter:blur(1px))]:bg-black/20 md:inset-x-2.5 md:bottom-2.5 md:space-y-3 md:p-4">
        <div className="pointer-events-none space-y-1">
          <p className="king-label flex flex-wrap gap-x-2 text-[0.55rem]">
            {product.categoryName && <span className="text-king-bright-red">{product.categoryName}</span>}
            {product.compareAt ? <span className="text-king-gray line-through">{formatDA(product.compareAt)}</span> : null}
          </p>
          <h3 className="king-display text-[clamp(1rem,3.2vw,1.9rem)] leading-[0.92] text-king-white">{product.name}</h3>
        </div>
        <div className="hidden md:block">
          <ShopChips shops={c.inStock.length ? c.inStock : product.shops} />
        </div>
        {c.inStock.length > 0 && (
          <p className="pointer-events-none truncate text-[0.65rem] text-king-muted md:hidden">
            <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-400 align-middle" aria-hidden />
            {c.inStock.map((x) => shortShop(x.name)).join(" · ")}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="pointer-events-none inline-flex min-w-0 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[0.72rem] font-semibold whitespace-nowrap text-king-white tabular-nums md:gap-1.5 md:px-3 md:py-1.5 md:text-sm">
            <Tag className="size-3 shrink-0 text-king-bright-red md:size-3.5" aria-hidden />
            {formatDA(product.price)}
          </span>
          <button
            type="button"
            onClick={c.add}
            disabled={c.soldOut}
            aria-label={c.soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
            className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-king-bright-red md:size-9 text-xs font-semibold whitespace-nowrap text-king-white transition-colors hover:bg-king-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-king-white disabled:bg-white/10 disabled:text-king-gray xl:w-auto xl:px-3.5"
          >
            <ShoppingBag className="size-3.5" aria-hidden />
            <span className="hidden xl:inline">{c.soldOut ? "Sold out" : "Add to cart"}</span>
          </button>
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* 2 — Minimal editorial                                              */
/* ------------------------------------------------------------------ */

export function EditorialCard({ product, index, sizes = [50, 50, 25] }: { product: CardProduct; index: number; sizes?: [number, number, number] }) {
  const c = useCard(product)
  return (
    <article className="group relative isolate aspect-[4/5] overflow-hidden bg-king-card">
      <Photo product={product} image={c.image} sizes={sizes} />
      <CardLink product={product} />
      <span className="king-label pointer-events-none absolute top-3 left-3 z-[2] text-[0.55rem] text-king-white/80 mix-blend-difference">
        {String(index + 1).padStart(2, "0")}
        {product.categoryName ? ` / ${product.categoryName}` : ""}
      </span>
      <div className="absolute top-2 right-2 z-10 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100 md:group-has-[:focus-visible]:opacity-100 md:[&:has(button[aria-pressed=true])]:opacity-100">
        <WishButton saved={c.saved} onClick={c.wish} name={product.name} />
      </div>
      {c.soldOut && (
        <span className="king-label pointer-events-none absolute inset-x-0 top-1/2 z-[2] -translate-y-1/2 text-center text-[0.6rem] text-king-white">
          Out of stock
        </span>
      )}

      {/* Revealed on hover / keyboard focus; always visible on touch screens. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3.5 pt-16 transition-[opacity,transform] duration-500 ease-[var(--ease-king)] md:p-4 md:pt-20",
          "md:translate-y-3 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-has-[:focus-visible]:translate-y-0 md:group-has-[:focus-visible]:opacity-100",
          "[@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"
        )}
      >
        <div className="flex items-end justify-between gap-3">
          <h3 className="text-[0.8rem] leading-snug font-semibold tracking-tight text-king-white uppercase md:text-sm">{product.name}</h3>
          <span className="king-label shrink-0 text-[0.6rem] text-king-white">
            {product.compareAt ? <span className="mr-1.5 text-king-gray line-through">{formatDA(product.compareAt)}</span> : null}
            <span className={product.compareAt ? "text-king-bright-red" : undefined}>{formatDA(product.price)}</span>
          </span>
        </div>
        {c.inStock.length > 0 && <p className="mt-1.5 text-[0.7rem] text-king-gray">{c.inStock.map((s) => shortShop(s.name)).join(" · ")}</p>}
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* 3 — Hang tag + shops (owner's reference)                           */
/* ------------------------------------------------------------------ */

export function HangTagCard({ product, sizes = [50, 50, 25] }: { product: CardProduct; sizes?: [number, number, number] }) {
  const c = useCard(product)
  return (
    <article
      className={cn(
        "group relative isolate aspect-[4/5] overflow-hidden rounded-[22px] bg-king-card ring-1 ring-white/12",
        "transition-shadow duration-500 hover:ring-king-bright-red/55 hover:shadow-[0_0_44px_-10px_rgba(212,20,20,0.6)] has-[:focus-visible]:ring-king-bright-red"
      )}
    >
      <Photo product={product} image={c.image} sizes={sizes} />
      <CardLink product={product} />

      {/* Paper hang tag with the price */}
      <div
        className="pointer-events-none absolute top-0 left-[6%] z-[2] flex w-[34%] max-w-32 flex-col items-center bg-[#f2efe9] px-1.5 pt-1.5 pb-3.5 text-[#0b0b0b] md:w-[30%] md:min-w-24 md:px-2 md:pt-2.5 md:pb-5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_86%,0_100%)]"
        aria-label={product.price === null ? "Price soon" : `${formatDA(product.price)}`}
      >
        <span className="size-1.5 rounded-full bg-[#0b0b0b] md:size-2" aria-hidden />
        <span className="king-label mt-1 text-[0.4rem] text-king-red md:mt-1.5 md:text-[0.5rem]">KING 253</span>
        {product.price === null ? (
          <span className="mt-1 text-sm font-bold">Soon</span>
        ) : (
          <>
            <span className="mt-0.5 text-[0.95rem] leading-none font-extrabold tracking-tight whitespace-nowrap tabular-nums md:text-[clamp(1.05rem,2.6vw,1.55rem)]">
              {product.price.toLocaleString("fr-DZ")}
            </span>
            <span className="king-label text-[0.45rem] md:text-[0.55rem]">DA</span>
            {product.compareAt ? <span className="mt-0.5 hidden text-[0.6rem] text-[#6b6b6b] line-through md:block">{formatDA(product.compareAt)}</span> : null}
          </>
        )}
      </div>
      <div className="absolute top-3 right-3 z-10">
        <WishButton saved={c.saved} onClick={c.wish} name={product.name} className="bg-black/35 backdrop-blur-md hover:bg-black/55" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[62%] bg-gradient-to-t from-black via-black/60 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 z-[3] space-y-2 p-3 md:space-y-3 md:p-5">
        <div className="pointer-events-none space-y-1.5">
          {product.categoryName && <p className="king-label hidden text-[0.55rem] text-king-muted md:block">{product.categoryName}</p>}
          <h3 className="king-display text-[1.05rem] leading-[0.92] text-king-white md:max-w-[80%] md:text-[clamp(1.5rem,3.6vw,2.2rem)]">{product.name}</h3>
        </div>
        {c.soldOut ? (
          <p className="king-label text-[0.5rem] text-king-gray md:text-[0.55rem]">Out of stock</p>
        ) : (
          <>
            <div className="hidden md:block">
              <ShopChips shops={product.shops} />
            </div>
            <ul className="pointer-events-none space-y-0.5 text-[0.65rem] text-king-muted md:hidden" aria-label="Available in">
              {c.inStock.map((x) => (
                <li key={x.storeId} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className={cn("size-1.5 rounded-full", x.available <= LOW ? "bg-amber-400" : "bg-emerald-400")} aria-hidden />
                  {shortShop(x.name)}
                  {x.available <= LOW ? ` · ${x.available} left` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex items-end justify-between gap-3">
          <p className="pointer-events-none hidden truncate text-xs text-king-muted md:block">{product.colours.map((x) => x.name).join(" · ")}</p>
          <button
            type="button"
            onClick={c.add}
            disabled={c.soldOut}
            aria-label={c.soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
            className="relative z-10 ml-auto grid size-10 shrink-0 place-items-center rounded-full bg-king-white text-king-black transition-[background-color,transform] duration-300 hover:scale-105 hover:bg-king-bright-red hover:text-king-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-king-bright-red focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:scale-100 disabled:bg-white/15 disabled:text-king-gray md:size-14"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  )
}

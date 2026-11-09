"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, SlidersHorizontal, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import { promoBarText } from "@/components/shop/stock"
import type { CatalogFilters, ProductCardData, Sort } from "@/server/catalog"
import { useShop } from "@/components/providers/shop-provider"
import { ProductCard } from "@/components/shop/product-card"
import { InteractiveCard } from "@/components/ui/3d-card"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const SORTS: Sort[] = ["featured", "newest", "price_asc", "price_desc", "popular", "rating"]

type Facets = {
  categories: { slug: string; name: string }[]
  subcategories: { slug: string; name: string; parentSlug: string }[]
  sizes: string[]
  colours: { name: string; hex: string | null }[]
  priceRange: { min: number | null; max: number | null }
}

export function Catalog({
  products,
  total,
  page,
  pages,
  facets,
  filters,
}: {
  products: ProductCardData[]
  total: number
  page: number
  pages: number
  facets: Facets
  filters: CatalogFilters
}) {
  const t = useTranslations("catalog")
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  /** Update the URL; the server re-queries the database. */
  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k)
        else next.set(k, v)
      }
      if (!("page" in patch)) next.delete("page")
      const qs = next.toString()
      startTransition(() => router.push(qs ? `${pathname}?${qs}#catalog` : `${pathname}#catalog`, { scroll: false }))
    },
    [params, pathname, router]
  )

  const activeCount = [filters.size, filters.color, filters.gender, filters.inStock ? "1" : undefined, filters.minPrice, filters.maxPrice].filter(
    (v) => v !== undefined
  ).length
  // A subcategory selected → its main category stays highlighted and its siblings show as chips.
  const selected = filters.category ?? ""
  const activeMain = facets.subcategories.find((c) => c.slug === selected)?.parentSlug ?? selected
  const mainName = facets.categories.find((c) => c.slug === activeMain)?.name ?? ""
  const subs = activeMain ? facets.subcategories.filter((c) => c.parentSlug === activeMain) : []
  const showFeature = !filters.category && !filters.q && (filters.sort ?? "featured") === "featured" && !activeCount && page === 1

  return (
    <section id="catalog" aria-labelledby="new-collection-title" className="relative scroll-mt-16 bg-king-black pb-28">
      {/* FRZN-style header: big title + bracketed tags */}
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 pt-16 pb-10 sm:px-6 md:pt-24 lg:flex-row lg:items-end lg:justify-between lg:px-12">
        <h2 id="new-collection-title" className="king-display text-[clamp(2.75rem,6.5vw,6.5rem)] text-king-white">
          {t("newCollection")}
        </h2>
        <div className="grid grid-cols-2 gap-x-10 gap-y-1 lg:pb-3">
          <ul className="king-label space-y-1.5 text-[0.55rem] text-king-gray">
            <li>{t("tagNew")}</li>
            <li>{t("tagStudio")}</li>
            <li>{t("tagStreet")}</li>
          </ul>
          <ul className="king-label space-y-1.5 text-[0.55rem] text-king-gray">
            {facets.categories.slice(0, 4).map((c) => (
              <li key={c.slug}>{c.name}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 border-y border-white/[0.06] bg-king-black/95 transition-[top] duration-500 ease-king lg:top-[72px] [html[data-nav-hidden]_&]:top-0">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div role="group" aria-label={t("filterByCategory")} className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {[{ slug: "", name: t("all") }, ...facets.categories].map((c) => {
              const active = activeMain === c.slug
              return (
                <button
                  key={c.slug || "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ category: c.slug || null })}
                  className={cn(
                    "king-label relative h-10 shrink-0 px-3 text-[0.65rem] transition-colors duration-300",
                    "after:absolute after:inset-x-3 after:bottom-1.5 after:h-px after:origin-left after:bg-king-bright-red after:transition-transform after:duration-500 after:ease-king",
                    active ? "text-king-white after:scale-x-100" : "text-king-gray after:scale-x-0 hover:text-king-white"
                  )}
                >
                  {c.name}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <p className="king-label shrink-0 text-[0.6rem] text-king-gray" aria-live="polite">
              {t("pieces", { count: total })}
            </p>
            <div className="flex min-w-0 items-center gap-2">
              <FilterSheet facets={facets} filters={filters} update={update} activeCount={activeCount} />
              <label className="relative flex min-w-0 items-center">
                <span className="sr-only">{t("sort")}</span>
                <select
                  value={filters.sort ?? "featured"}
                  onChange={(e) => update({ sort: e.target.value === "featured" ? null : e.target.value })}
                  className="king-label h-10 w-full min-w-0 appearance-none truncate border border-white/15 bg-king-black py-0 pr-9 pl-3 text-[0.65rem] text-king-white transition-colors hover:border-white/35 focus:border-king-bright-red focus:outline-none"
                >
                  {SORTS.map((value) => (
                    <option key={value} value={value}>
                      {t(`sort_${value}`)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-king-gray" aria-hidden />
              </label>
            </div>
          </div>
        </div>
        {subs.length > 0 && (
          <div
            role="group"
            aria-label={t("filterOf", { name: mainName })}
            className="mx-auto flex max-w-[1600px] gap-2 overflow-x-auto border-t border-white/[0.06] px-4 py-2.5 [scrollbar-width:none] sm:px-6 lg:px-12 [&::-webkit-scrollbar]:hidden"
          >
            {[{ slug: activeMain, name: t("allOf", { name: mainName }) }, ...subs].map((c) => {
              const on = (filters.category ?? "") === c.slug
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ category: c.slug })}
                  className={cn(
                    "king-label h-8 shrink-0 rounded-full border px-3.5 text-[0.55rem] transition-colors",
                    on ? "border-king-bright-red bg-king-red/15 text-king-white" : "border-white/15 text-king-gray hover:border-white/35 hover:text-king-white"
                  )}
                >
                  {c.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className={cn("mx-auto max-w-[1600px] px-4 pt-10 transition-opacity sm:px-6 md:pt-14 lg:px-12", pending && "opacity-60")}>
        {(filters.q || activeCount > 0) && (
          <div className="mb-8 flex flex-wrap gap-2">
            {filters.q && <Chip label={`“${filters.q}”`} onClear={() => update({ q: null })} />}
            {filters.size && <Chip label={t("size", { size: filters.size })} onClear={() => update({ size: null })} />}
            {filters.color && <Chip label={filters.color} onClear={() => update({ color: null })} />}
            {filters.gender && <Chip label={t(`gender_${filters.gender}`)} onClear={() => update({ gender: null })} />}
            {filters.inStock && <Chip label={t("inStock")} onClear={() => update({ stock: null })} />}
            {filters.minPrice !== undefined && <Chip label={t("from", { price: formatDA(filters.minPrice) })} onClear={() => update({ min: null })} />}
            {filters.maxPrice !== undefined && <Chip label={t("upTo", { price: formatDA(filters.maxPrice) })} onClear={() => update({ max: null })} />}
            <button type="button" onClick={() => router.push(`${pathname}#catalog`, { scroll: false })} className="king-label h-9 px-3 text-[0.6rem] text-king-gray hover:text-king-white">
              {t("clearAll")}
            </button>
          </div>
        )}

        {products.length === 0 ? (
          <div className="py-32 text-center">
            <p className="king-display text-5xl text-king-white md:text-7xl">{t("nothing")}</p>
            <p className="mt-4 text-sm text-king-gray">{t("noMatch")}</p>
            <Link href="/clothes#catalog" className="king-label mt-8 inline-flex h-12 items-center border border-white/25 px-6 text-king-white hover:border-king-white">
              {t("viewAll")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 md:gap-y-14 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product, i) => {
              const featured = i === 0 && showFeature
              return (
                <div
                  key={product.id}
                  className={cn(
                    "animate-in fill-mode-both fade-in-0 slide-in-from-bottom-4 duration-700 motion-reduce:animate-none",
                    featured && "col-span-2"
                  )}
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                >
                  {featured ? <FeatureCard product={product} /> : <ProductCard product={product} index={(page - 1) * 24 + i} sizes={[50, 50, 20]} />}
                </div>
              )
            })}
          </div>
        )}

        {pages > 1 && (
          <nav aria-label={t("pages")} className="mt-16 flex items-center justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-current={n === page ? "page" : undefined}
                onClick={() => update({ page: n === 1 ? null : String(n) })}
                className={cn(
                  "king-label grid size-10 place-items-center border text-[0.65rem] transition-colors",
                  n === page ? "border-king-bright-red text-king-white" : "border-white/15 text-king-gray hover:text-king-white"
                )}
              >
                {n}
              </button>
            ))}
          </nav>
        )}
      </div>
    </section>
  )
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  const t = useTranslations("catalog")
  return (
    <button
      type="button"
      onClick={onClear}
      className="king-label inline-flex h-9 items-center gap-2 border border-white/15 px-3 text-[0.6rem] text-king-white hover:border-king-bright-red"
    >
      {label} <X className="size-3" aria-label={t("removeFilter")} />
    </button>
  )
}

function FilterSheet({
  facets,
  filters,
  update,
  activeCount,
}: {
  facets: Facets
  filters: CatalogFilters
  update: (patch: Record<string, string | null>) => void
  activeCount: number
}) {
  const t = useTranslations("catalog")
  const [open, setOpen] = React.useState(false)
  const [min, setMin] = React.useState(filters.minPrice?.toString() ?? "")
  const [max, setMax] = React.useState(filters.maxPrice?.toString() ?? "")
  const option = (active: boolean) =>
    cn(
      "king-label h-10 border px-3 text-[0.6rem] transition-colors",
      active ? "border-king-bright-red bg-king-red/15 text-king-white" : "border-white/15 text-king-muted hover:text-king-white"
    )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="king-label inline-flex h-10 shrink-0 items-center gap-2 border border-white/15 px-3 text-[0.65rem] text-king-white hover:border-white/35">
          <SlidersHorizontal className="size-3.5" aria-hidden /> {t("filters")}{activeCount ? ` (${activeCount})` : ""}
        </button>
      </SheetTrigger>
      <SheetContent side="right" data-lenis-prevent className="gap-0 overflow-y-auto border-white/10 bg-king-near-black p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
        <div className="border-b border-white/10 px-6 py-6">
          <SheetTitle className="king-label text-king-white">{t("filters")}</SheetTitle>
          <SheetDescription className="sr-only">{t("filtersHelp")}</SheetDescription>
        </div>
        <div className="space-y-8 px-6 py-6">
          <FilterGroup title={t("availability")}>
            <button type="button" className={option(!!filters.inStock)} onClick={() => update({ stock: filters.inStock ? null : "1" })}>
              In stock only
            </button>
          </FilterGroup>
          {facets.sizes.length > 0 && (
            <FilterGroup title={t("sizeTitle")}>
              {facets.sizes.map((s) => (
                <button key={s} type="button" className={option(filters.size === s)} onClick={() => update({ size: filters.size === s ? null : s })}>
                  {s}
                </button>
              ))}
            </FilterGroup>
          )}
          {facets.colours.length > 0 && (
            <FilterGroup title={t("colour")}>
              {facets.colours.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={cn(option(filters.color === c.name), "inline-flex items-center gap-2")}
                  onClick={() => update({ color: filters.color === c.name ? null : c.name })}
                >
                  <span className="size-3 rounded-full ring-1 ring-white/25" style={{ backgroundColor: c.hex ?? "#555" }} aria-hidden />
                  {c.name}
                </button>
              ))}
            </FilterGroup>
          )}
          <FilterGroup title={t("fitFor")}>
            {(["men", "women", "unisex"] as const).map((g) => (
              <button key={g} type="button" className={option(filters.gender === g)} onClick={() => update({ gender: filters.gender === g ? null : g })}>
                {t(`gender_${g}`)}
              </button>
            ))}
          </FilterGroup>
          <FilterGroup title={`${t("price")}${facets.priceRange.min !== null ? ` · ${formatDA(facets.priceRange.min)} – ${formatDA(facets.priceRange.max)}` : ""}`}>
            <form
              className="flex w-full items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                update({ min: min.trim() || null, max: max.trim() || null })
                setOpen(false)
              }}
            >
              <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} placeholder={t("min")} aria-label={t("minPrice")} className="h-10 w-full border border-white/15 bg-black/40 px-3 text-sm text-king-white" />
              <span className="text-king-gray">–</span>
              <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} placeholder={t("max")} aria-label={t("maxPrice")} className="h-10 w-full border border-white/15 bg-black/40 px-3 text-sm text-king-white" />
              <button type="submit" className="king-label h-10 shrink-0 bg-king-red px-4 text-[0.6rem] text-king-white hover:bg-king-bright-red">
                {t("apply")}
              </button>
            </form>
          </FilterGroup>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="king-label mb-3 text-[0.6rem] text-king-gray">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

/** Wide campaign card leading the grid — full look, title on the image. */
function FeatureCard({ product }: { product: ProductCardData }) {
  const t = useTranslations("catalog")
  const ts = useTranslations("stock")
  const { setQuickView } = useShop()
  const image = product.image
  return (
    <article className="group">
      <InteractiveCard
        className="aspect-[4/5] sm:aspect-[8/5]"
        imageUrl={image?.url ?? "/images/hero/2.jpg"}
        imageAlt={t("campaign", { name: product.name })}
        focus={{ x: image?.focusX ?? 50, y: 40 }}
        zoom={1}
        sizes="(min-width: 1280px) 40vw, (min-width: 1024px) 50vw, 100vw"
        title={product.name}
        subtitle={t("featured", { category: product.categoryName ?? "" })}
        href={`/product/${product.slug}`}
        arrowLabel={t("view", { name: product.name })}
        actionText={product.available > 0 ? t("viewDetailsPrice", { price: formatDA(product.price) }) : t("outOfStock")}
        actionDisabled={product.available <= 0}
        linkWholeCard
        promo={promoBarText(product, ts)}
      />
      <div className="mt-3 flex items-center justify-between gap-4 md:mt-4">
        <p className="king-label flex flex-wrap items-center gap-2 text-[0.55rem] text-king-gray">
          {t("featuredLook")}
          {product.compareAt ? <span className="line-through">{formatDA(product.compareAt)}</span> : null}
        </p>
        {product.colours[0] && (
          <p className="king-label flex items-center gap-2 text-[0.55rem] text-king-gray">
            <span className="size-2 rounded-full ring-1 ring-white/25" style={{ backgroundColor: product.colours[0].hex ?? "#555" }} aria-hidden />
            {product.colours[0].name}
          </p>
        )}
      </div>
    </article>
  )
}

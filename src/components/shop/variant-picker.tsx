"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { sortSizes } from "@/lib/sizes"
import { ProductImage, type Crop } from "@/components/shop/product-image"

export type PickerVariant = { id: string; size: string; color: string; colorHex: string | null; price?: number | null; compareAt?: number | null; available: number }

/**
 * Colour then size. Sizes without stock stay visible but disabled (struck
 * through) — availability always comes from the server, never typed by admin.
 */
export function useVariantSelection<V extends PickerVariant>(variants: V[], initialColour?: string | null) {
  const colours = React.useMemo(() => {
    const seen = new Map<string, string | null>()
    for (const v of variants) if (!seen.has(v.color)) seen.set(v.color, v.colorHex)
    return [...seen.entries()].map(([name, hex]) => ({ name, hex, available: variants.some((v) => v.color === name && v.available > 0) }))
  }, [variants])

  const wanted = initialColour ? colours.find((c) => c.name.toLowerCase() === initialColour.toLowerCase())?.name : undefined
  const firstColour = wanted ?? colours.find((c) => c.available)?.name ?? colours[0]?.name ?? null
  const [colour, setColour] = React.useState<string | null>(firstColour)
  const sizes = React.useMemo(
    () => sortSizes(variants.filter((v) => v.color === colour).map((v) => v.size)),
    [variants, colour]
  )
  const onlyOneSize = sizes.length === 1
  const [size, setSize] = React.useState<string | null>(null)
  const effectiveSize = onlyOneSize ? sizes[0] : size && sizes.includes(size) ? size : null
  const variant = variants.find((v) => v.color === colour && v.size === effectiveSize) ?? null

  // Price of the chosen colour before a size is picked (its cheapest size), with its promo.
  const colourOffer = variants
    .filter((v) => v.color === colour && v.price !== null && v.price !== undefined)
    .reduce<V | null>((best, v) => (best === null || (v.price as number) < (best.price as number) ? v : best), null)
  const colourPrice = colourOffer?.price ?? null
  const colourCompareAt = colourOffer?.compareAt ?? null

  return { colours, colour, setColour, sizes, size: effectiveSize, setSize, variant, colourPrice, colourCompareAt }
}

export type VariantSelection<V extends PickerVariant = PickerVariant> = ReturnType<typeof useVariantSelection<V>>

/* Shared selection for the product page: the buy box picks, the gallery follows. */
const SelectionContext = React.createContext<VariantSelection | null>(null)

export function ProductSelectionProvider({
  variants,
  initialColour,
  children,
}: {
  variants: PickerVariant[]
  initialColour?: string | null
  children: React.ReactNode
}) {
  const selection = useVariantSelection(variants, initialColour)
  return <SelectionContext.Provider value={selection}>{children}</SelectionContext.Provider>
}

export function useProductSelection() {
  return React.useContext(SelectionContext)
}

/**
 * Only the chosen colour's photos. The product's general photos (no colour)
 * are for the product card; they show here only while a colour has no photos
 * of its own yet, so the page is never empty.
 */
export function imagesForColour<I extends Crop & { color?: string | null }>(images: I[], colour: string | null): I[] {
  const own = colour ? images.filter((i) => i.color === colour) : []
  if (own.length) return own
  const shared = images.filter((i) => !i.color)
  return shared.length ? shared : images
}

export function VariantPicker<V extends PickerVariant>({
  variants,
  selection,
  compact = false,
  colourImages,
}: {
  variants: V[]
  selection: VariantSelection<V>
  compact?: boolean
  /** First photo of each colour — shown inside the colour chips. */
  colourImages?: Record<string, Crop | null>
}) {
  const { colours, colour, setColour, sizes, size, setSize } = selection
  return (
    <div className="space-y-5">
      {colours.length > 0 && (
        <fieldset>
          <legend className="king-label mb-3 flex flex-wrap items-baseline gap-x-2 text-[0.6rem] text-king-gray">
            Colour <span className="text-king-white">— {colour}</span>
            {colours.length > 1 && <span className="tracking-normal normal-case">· {colours.length} colours available</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {colours.map((c) => {
              const active = c.name === colour
              const photo = colourImages?.[c.name] ?? null
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColour(c.name)}
                  aria-pressed={active}
                  aria-label={`${c.name}${c.available ? "" : " — out of stock"}`}
                  className={cn(
                    "group flex h-12 items-center gap-2.5 rounded-full border py-1 pr-4 pl-1 text-left transition-colors",
                    active ? "border-king-bright-red bg-king-red/15" : "border-white/15 hover:border-white/40",
                    !c.available && "opacity-50"
                  )}
                >
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-white/20" style={{ backgroundColor: c.hex ?? "#555" }} aria-hidden>
                    {photo && <ProductImage image={photo} alt="" sizes="48px" />}
                    {photo && <span className="absolute right-0 bottom-0 size-3.5 rounded-full ring-2 ring-king-near-black" style={{ backgroundColor: c.hex ?? "#555" }} />}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className={cn("text-xs font-semibold tracking-wide uppercase", active ? "text-king-white" : "text-king-muted group-hover:text-king-white")}>{c.name}</span>
                    {!c.available && <span className="text-[0.65rem] text-king-gray">Sold out</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="king-label mb-3 text-[0.6rem] text-king-gray">
          Size{size ? <span className="text-king-white"> — {size}</span> : null}
        </legend>
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => {
            const v = variants.find((x) => x.color === colour && x.size === s)
            const out = !v || v.available <= 0
            return (
              <button
                key={s}
                type="button"
                disabled={out}
                onClick={() => setSize(s)}
                aria-pressed={s === size}
                aria-label={`Size ${s}${out ? " — out of stock" : ""}`}
                className={cn(
                  "king-label h-11 border px-4 text-[0.65rem] transition-colors",
                  compact ? "min-w-11" : "min-w-12",
                  s === size ? "border-king-bright-red bg-king-red/15 text-king-white" : "border-white/15 text-king-muted hover:border-white/40 hover:text-king-white",
                  out && "cursor-not-allowed text-king-gray line-through opacity-50 hover:border-white/15 hover:text-king-gray"
                )}
              >
                {s}
              </button>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}

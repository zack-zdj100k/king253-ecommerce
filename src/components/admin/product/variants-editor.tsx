"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import { hexForName } from "@/lib/colours"
import { sortSizes } from "@/lib/sizes"
import { createVariantAction, deleteVariantAction, saveColourAction, updateVariantAction } from "@/app/admin/actions/products"
import { ColourPicker } from "@/components/admin/colour-picker"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { ImagesManager, type Img } from "@/components/admin/product/images-manager"
import { StockAdjust } from "@/components/admin/product/stock-adjust"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass } from "@/components/admin/ui"
import { ConfirmButton } from "@/components/admin/confirm-button"

type Variant = {
  id: string
  sku: string
  barcode: string | null
  size: string
  color: string
  colorHex: string | null
  priceOverride: number | null
  salePriceOverride: number | null
  lowStockThreshold: number | null
  sortOrder: number
  active: boolean
  physical: number
  reserved: number
}

type Colour = { name: string; hex: string | null; price: number | null; promo: number | null; mixedPrice: boolean; variants: Variant[] }
type ProductPricing = { price: number | null; salePrice: number | null }

const pct = (promo: number, regular: number) => Math.round(((regular - promo) / regular) * 100)

const part = (s: string, len: number) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, len) || "X"
const sku = (base: string, color: string, size: string, n: number) => `KING-${part(base, 4)}-${part(color, 3)}-${part(size, 4)}-${String(n).padStart(3, "0")}`
const digits = (v: string) => v.replace(/\D/g, "")

/** Next free running number for suggested SKUs (survives deletions). */
function nextNumber(variants: Variant[]) {
  return variants.reduce((m, v) => Math.max(m, Number(v.sku.match(/-(\d{3,})$/)?.[1] ?? 0)), variants.length) + 1
}

function groupColours(variants: Variant[]): Colour[] {
  const map = new Map<string, Variant[]>()
  for (const v of variants) map.set(v.color, [...(map.get(v.color) ?? []), v])
  return [...map.entries()].map(([name, list]) => {
    const prices = new Set(list.map((v) => `${v.priceOverride}/${v.salePriceOverride}`))
    const order = sortSizes(list.map((v) => v.size))
    return {
      name,
      hex: list.find((v) => v.colorHex)?.colorHex ?? null,
      price: prices.size === 1 ? list[0].priceOverride : null,
      promo: prices.size === 1 ? list[0].salePriceOverride : null,
      mixedPrice: prices.size > 1,
      variants: [...list].sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size)),
    }
  })
}

/**
 * Each colour is a card: swatch, name, price, its own photos, and its sizes
 * with stock. The shop shows a colour's photos when the customer picks it.
 */
export function VariantsEditor({
  productId,
  product,
  variants,
  images,
  threshold,
}: {
  productId: string
  product: { slug: string; categorySlug: string | null; pricing: ProductPricing }
  variants: Variant[]
  images: Img[]
  threshold: number
}) {
  const colours = groupColours(variants)
  const names = colours.map((c) => c.name)
  const base = product.categorySlug ?? product.slug
  const next = nextNumber(variants)

  return (
    <div className="space-y-6">
      {colours.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-king-gray">
          No colours yet — the product shows &ldquo;sizes coming soon&rdquo; until you add one below.
        </p>
      ) : (
        colours.map((c) => (
          <ColourCard
            key={c.name}
            productId={productId}
            colour={c}
            colourNames={names}
            images={images.filter((i) => i.color === c.name)}
            pricing={product.pricing}
            threshold={threshold}
            base={base}
            next={next}
          />
        ))
      )}
      <AddColour productId={productId} base={base} next={next} offset={variants.length} pricing={product.pricing} />
    </div>
  )
}

function ColourCard({
  productId,
  colour,
  colourNames,
  images,
  pricing,
  threshold,
  base,
  next,
}: {
  productId: string
  colour: Colour
  colourNames: string[]
  images: Img[]
  pricing: ProductPricing
  threshold: number
  base: string
  next: number
}) {
  const { run, pending, feedback } = useAdminAction()
  const initial = {
    name: colour.name,
    hex: colour.hex ?? "#222222",
    price: colour.price === null ? "" : String(colour.price),
    promo: colour.promo === null ? "" : String(colour.promo),
  }
  const [v, setV] = React.useState(initial)
  const dirty = v.name !== initial.name || v.hex !== initial.hex || v.price !== initial.price || v.promo !== initial.promo
  const offer = sellingPrice(v.price, v.promo, pricing)
  const available = colour.variants.reduce((s, x) => s + Math.max(0, x.physical - x.reserved), 0)

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <form
        className="flex flex-wrap items-end gap-3 border-b border-white/10 p-4 md:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => saveColourAction(productId, colour.name, { name: v.name, hex: v.hex, price: v.price, promo: v.promo }))
        }}
      >
        <div>
          <span className={labelClass}>Swatch</span>
          <ColourPicker value={v.hex} onChange={(hex) => setV({ ...v, hex })} />
        </div>
        <label className="block min-w-40 flex-1">
          <span className={labelClass}>Colour name</span>
          <input
            value={v.name}
            onChange={(e) => {
              const name = e.target.value
              setV({ ...v, name, hex: hexForName(name) ?? v.hex })
            }}
            className={inputClass}
          />
        </label>
        <label className="block w-40">
          <span className={labelClass}>Regular price (DA)</span>
          <input
            value={v.price}
            onChange={(e) => setV({ ...v, price: digits(e.target.value) })}
            inputMode="numeric"
            placeholder={colour.mixedPrice ? "Different per size" : pricing.price !== null ? `${pricing.price} (product)` : "Product price"}
            className={inputClass}
          />
        </label>
        <label className="block w-40">
          <span className={labelClass}>Promo price (DA)</span>
          <input
            value={v.promo}
            onChange={(e) => setV({ ...v, promo: digits(e.target.value) })}
            inputMode="numeric"
            placeholder={v.price === "" && pricing.salePrice !== null ? `${pricing.salePrice} (product promo)` : "No promo"}
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={!dirty || pending || !v.name.trim()} className={btnOutline}>
          Save colour
        </button>
        <p className="w-full text-xs text-king-gray md:ml-auto md:w-auto">
          {colour.variants.length} size{colour.variants.length === 1 ? "" : "s"} · {available} available
          {offer.price !== null ? (
            <>
              {" · sells at "}
              <span className="font-medium text-king-white">{formatDA(offer.price)}</span>
              {offer.compareAt ? <span className="text-king-bright-red">{` (promo −${pct(offer.price, offer.compareAt)}%, was ${formatDA(offer.compareAt)})`}</span> : null}
            </>
          ) : null}
          {v.price !== "" && v.promo === "" && pricing.salePrice !== null && (
            <span className="block text-king-gray/80">Not in the product promo (own price). Empty its price to include it.</span>
          )}
        </p>
        <div className="w-full">
          <Feedback feedback={feedback} />
        </div>
      </form>

      <div className="space-y-3 border-b border-white/10 p-4 md:p-5">
        <p className="text-xs font-medium text-king-gray">
          {colour.name} photos <span className="normal-case tracking-normal">— shown when the customer picks this colour</span>
        </p>
        <ImagesManager productId={productId} images={images} color={colour.name} colours={colourNames} compact />
      </div>

      <div className="p-4 md:p-5">
        <div className="hidden grid-cols-[72px_minmax(0,1.3fr)_88px_minmax(0,1fr)_auto] gap-3 pb-2 text-xs font-medium text-king-gray md:grid">
          <span>Size</span>
          <span>SKU / barcode</span>
          <span>Low alert</span>
          <span>Stock — physical · reserved · available</span>
          <span />
        </div>
        <ul className="divide-y divide-white/5">
          {colour.variants.map((variant) => (
            <SizeRow key={variant.id} productId={productId} variant={variant} threshold={threshold} />
          ))}
        </ul>
        <AddSizes productId={productId} colour={colour} base={base} next={next} existing={colour.variants.map((x) => x.size)} />
      </div>
    </section>
  )
}

function SizeRow({ productId, variant, threshold }: { productId: string; variant: Variant; threshold: number }) {
  const { run, pending, feedback } = useAdminAction()
  const initial = {
    size: variant.size,
    sku: variant.sku,
    barcode: variant.barcode ?? "",
    lowStockThreshold: variant.lowStockThreshold === null ? "" : String(variant.lowStockThreshold),
    active: variant.active,
  }
  const [v, setV] = React.useState(initial)
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => v[k] !== initial[k])
  const available = variant.physical - variant.reserved
  const low = available > 0 && available <= (variant.lowStockThreshold ?? threshold)

  return (
    <li className={cn("grid gap-3 py-3 md:grid-cols-[72px_minmax(0,1.3fr)_88px_minmax(0,1fr)_auto] md:items-start", !variant.active && "opacity-55")}>
      <label className="block">
        <span className={cn(labelClass, "md:sr-only")}>Size</span>
        <input value={v.size} onChange={(e) => setV({ ...v, size: e.target.value })} aria-label="Size" className={inputClass} />
        <span className="mt-2 flex items-center gap-2 text-xs text-king-gray">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="accent-[#a30d0d]" aria-label="On sale" />
          On sale
        </span>
      </label>
      <div className="grid gap-2">
        <span className={cn(labelClass, "mb-0 md:sr-only")}>SKU / barcode</span>
        <input value={v.sku} onChange={(e) => setV({ ...v, sku: e.target.value.toUpperCase() })} aria-label="SKU" className={`${inputClass} font-mono text-xs`} />
        <input value={v.barcode} onChange={(e) => setV({ ...v, barcode: e.target.value })} placeholder="Barcode (optional)" aria-label="Barcode" className={`${inputClass} font-mono text-xs`} />
      </div>
      <label className="block">
        <span className={cn(labelClass, "md:sr-only")}>Low stock alert at</span>
        <input value={v.lowStockThreshold} onChange={(e) => setV({ ...v, lowStockThreshold: digits(e.target.value) })} placeholder={String(threshold)} aria-label="Low stock alert at" className={inputClass} />
      </label>
      <div>
        <span className={cn(labelClass, "md:sr-only")}>Stock</span>
        <div className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-king-white" title="Physical">{variant.physical}</span>
          <span className="text-king-gray">·</span>
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-king-muted" title="Reserved">{variant.reserved}</span>
          <span className="text-king-gray">·</span>
          <span
            className={cn("rounded-full px-3 py-1.5 font-semibold", available <= 0 ? "bg-white/5 text-king-gray" : low ? "bg-king-red/20 text-king-bright-red" : "bg-emerald-500/10 text-emerald-300")}
            title="Available"
          >
            {available <= 0 ? "Out" : available}
          </span>
          {low && <span className="text-xs text-king-bright-red">Low</span>}
        </div>
        <StockAdjust variantId={variant.id} physical={variant.physical} reserved={variant.reserved} />
      </div>
      <div className="flex flex-wrap items-start gap-1 md:justify-end">
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() =>
            run(() =>
              updateVariantAction(productId, variant.id, {
                ...v,
                color: variant.color,
                colorHex: variant.colorHex,
                priceOverride: variant.priceOverride,
                salePriceOverride: variant.salePriceOverride,
                sortOrder: variant.sortOrder,
              })
            )
          }
          className={btnOutline}
        >
          Save
        </button>
        <ConfirmButton
          danger
          disabled={pending}
          confirm={`Delete size ${variant.size}?`}
          confirmLabel="Yes, delete"
          onConfirm={() => run(() => deleteVariantAction(productId, variant.id))}
          className={btnGhost}
          ariaLabel={`Delete size ${variant.size}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </ConfirmButton>
        <div className="w-full md:text-right">
          <Feedback feedback={feedback} />
        </div>
      </div>
    </li>
  )
}

function AddSizes({ productId, colour, base, next, existing }: { productId: string; colour: Colour; base: string; next: number; existing: string[] }) {
  const { run, pending, feedback, setFeedback } = useAdminAction()
  const [sizes, setSizes] = React.useState("")
  const [stock, setStock] = React.useState("0")
  const list = sizes
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !existing.includes(s))

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-white/[0.03] p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!list.length) return setFeedback({ tone: "error", text: "Enter at least one new size." })
        run(async () => {
          for (const [i, size] of list.entries()) {
            const r = await createVariantAction(productId, {
              sku: sku(base, colour.name, size, next + i),
              size,
              color: colour.name,
              colorHex: colour.hex,
              priceOverride: colour.price,
              salePriceOverride: colour.promo,
              sortOrder: 0,
              active: true,
              initialStock: Number(stock) || 0,
            })
            if (!r.ok) return r
          }
          return { ok: true as const, message: `${list.length} size(s) added to ${colour.name}.` }
        }, () => setSizes(""))
      }}
    >
      <label className="block min-w-40 flex-1">
        <span className={labelClass}>Add sizes to {colour.name}</span>
        <input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="e.g. XL, XXL" className={inputClass} />
      </label>
      <label className="block w-32">
        <span className={labelClass}>Stock each</span>
        <input value={stock} onChange={(e) => setStock(digits(e.target.value))} inputMode="numeric" className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={btnOutline}>
        <Plus className="size-3.5" aria-hidden /> Add
      </button>
      <div className="w-full">
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

/** Add one colour in several sizes at once — with its price and opening stock. */
function AddColour({ productId, base, next, offset, pricing }: { productId: string; base: string; next: number; offset: number; pricing: ProductPricing }) {
  const { run, pending, feedback, setFeedback } = useAdminAction()
  const [color, setColor] = React.useState("")
  const [hex, setHex] = React.useState("#1f1f1f")
  const [price, setPrice] = React.useState("")
  const [promo, setPromo] = React.useState("")
  const [sizes, setSizes] = React.useState("S, M, L, XL")
  const [stock, setStock] = React.useState("0")
  const list = sizes.split(",").map((s) => s.trim()).filter(Boolean)

  return (
    <form
      className="space-y-4 rounded-2xl border border-dashed border-white/15 p-4 md:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!color.trim() || !list.length) return setFeedback({ tone: "error", text: "Enter a colour and at least one size." })
        run(async () => {
          for (const [i, size] of list.entries()) {
            const r = await createVariantAction(productId, {
              sku: sku(base, color, size, next + i),
              size,
              color: color.trim(),
              colorHex: hex,
              priceOverride: price,
              salePriceOverride: promo,
              sortOrder: offset + i,
              active: true,
              initialStock: Number(stock) || 0,
            })
            if (!r.ok) return r
          }
          return { ok: true as const, message: `${color.trim()} added in ${list.length} size(s). Now add its photos.` }
        }, () => {
          setColor("")
          setPrice("")
          setPromo("")
        })
      }}
    >
      <p className="flex items-center gap-2 text-xs font-medium text-king-white">
        <Plus className="size-3.5" aria-hidden /> Add a colour
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className={labelClass}>Swatch</span>
          <ColourPicker
            value={hex}
            onChange={(h, name) => {
              setHex(h)
              if (name && !color.trim()) setColor(name)
            }}
          />
        </div>
        <label className="block min-w-40 flex-1">
          <span className={labelClass}>Colour name</span>
          <input
            value={color}
            onChange={(e) => {
              setColor(e.target.value)
              const preset = hexForName(e.target.value)
              if (preset) setHex(preset)
            }}
            placeholder="e.g. Blue"
            className={inputClass}
          />
        </label>
        <label className="block w-40">
          <span className={labelClass}>Regular price (DA)</span>
          <input value={price} onChange={(e) => setPrice(digits(e.target.value))} inputMode="numeric" placeholder={pricing.price !== null ? `${pricing.price} (product)` : "Product price"} className={inputClass} />
        </label>
        <label className="block w-40">
          <span className={labelClass}>Promo price (DA)</span>
          <input value={promo} onChange={(e) => setPromo(digits(e.target.value))} inputMode="numeric" placeholder="No promo" className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-48 flex-1">
          <span className={labelClass}>Sizes (comma separated)</span>
          <input value={sizes} onChange={(e) => setSizes(e.target.value)} className={inputClass} />
        </label>
        <label className="block w-36">
          <span className={labelClass}>Opening stock each</span>
          <input value={stock} onChange={(e) => setStock(digits(e.target.value))} inputMode="numeric" className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={btnRed}>
          Add colour{list.length ? ` · ${list.length} size${list.length > 1 ? "s" : ""}` : ""}
        </button>
      </div>
      {color && list.length > 0 && <p className="font-mono text-xs break-words text-king-gray">SKUs: {list.map((s, i) => sku(base, color, s, next + i)).join(", ")}</p>}
      <Feedback feedback={feedback} />
    </form>
  )
}

/** Mirrors the shop's pricing rule (server/pricing.ts) for the live preview. */
function sellingPrice(price: string, promo: string, product: ProductPricing): { price: number | null; compareAt: number | null } {
  const own = price !== "" || promo !== ""
  const regular = price !== "" ? Number(price) : product.price
  const sale = own ? (promo !== "" ? Number(promo) : null) : product.salePrice
  if (sale !== null && (regular === null || sale < regular)) return { price: sale, compareAt: regular }
  return { price: regular, compareAt: null }
}

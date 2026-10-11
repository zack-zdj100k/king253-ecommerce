"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { saveProductAction } from "@/app/admin/actions/products"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { Panel, btnRed, inputClass, labelClass, selectClass, textareaClass } from "@/components/admin/ui"

type Initial = {
  name: string
  slug: string
  categoryId: number | null
  gender: "men" | "women" | "unisex"
  status: "draft" | "published" | "archived"
  price: number | null
  salePrice: number | null
  material: string | null
  fit: string | null
  style: string | null
  collection: string | null
  quality: string | null
  care: string | null
  shortDescription: string | null
  description: string | null
  story: string | null
  inspiration: string | null
  brandNote: string | null
  tags: string[]
  videoUrl: string | null
  featured: boolean
  seoTitle: string | null
  seoDescription: string | null
  ogImageUrl: string | null
}

const blank = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v))

export function ProductForm({ productId, categories, initial }: { productId: string | null; categories: { id: number; name: string; parentId: number | null }[]; initial: Initial | null }) {
  const { run, pending, feedback } = useAdminAction()
  const [v, setV] = React.useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    categoryId: blank(initial?.categoryId),
    gender: initial?.gender ?? "men",
    status: initial?.status ?? "draft",
    price: blank(initial?.price),
    salePrice: blank(initial?.salePrice),
    material: blank(initial?.material),
    fit: blank(initial?.fit),
    style: blank(initial?.style),
    collection: blank(initial?.collection),
    quality: blank(initial?.quality),
    care: blank(initial?.care),
    shortDescription: blank(initial?.shortDescription),
    description: blank(initial?.description),
    story: blank(initial?.story),
    inspiration: blank(initial?.inspiration),
    brandNote: blank(initial?.brandNote),
    tags: (initial?.tags ?? []).join(", "),
    videoUrl: blank(initial?.videoUrl),
    featured: initial?.featured ?? false,
    seoTitle: blank(initial?.seoTitle),
    seoDescription: blank(initial?.seoDescription),
    ogImageUrl: blank(initial?.ogImageUrl),
  })
  const set = (patch: Partial<typeof v>) => setV((s) => ({ ...s, ...patch }))
  const price = Number(v.price) || 0
  const sale = Number(v.salePrice) || 0
  const discount = price && sale && sale < price ? Math.round((1 - sale / price) * 100) : null

  const field = (key: keyof typeof v, label: string, opts: { area?: boolean; rows?: number; max?: number; hint?: string; type?: string } = {}) => (
    <label className="block">
      <span className={labelClass}>
        {label}
        {opts.max ? ` · ${String(v[key]).length}/${opts.max}` : ""}
      </span>
      {opts.area ? (
        <textarea value={String(v[key])} rows={opts.rows ?? 3} maxLength={opts.max} onChange={(e) => set({ [key]: e.target.value } as Partial<typeof v>)} className={textareaClass} />
      ) : (
        <input value={String(v[key])} type={opts.type ?? "text"} maxLength={opts.max} onChange={(e) => set({ [key]: e.target.value } as Partial<typeof v>)} className={inputClass} />
      )}
      {opts.hint && <span className="mt-1 block text-xs text-king-gray">{opts.hint}</span>}
    </label>
  )

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        run(() =>
          saveProductAction(productId, {
            ...v,
            categoryId: v.categoryId ? Number(v.categoryId) : null,
            price: v.price,
            salePrice: v.salePrice,
          } as never)
        )
      }}
    >
      <Panel title="Basics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {field("name", "Product name")}
          {field("slug", "URL slug", { hint: "Leave empty to generate from the name." })}
          <label className="block">
            <span className={labelClass}>Category</span>
            <select value={v.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={selectClass}>
              <option value="">—</option>
              {categories
                .filter((c) => c.parentId === null)
                .map((main) => {
                  const subs = categories.filter((c) => c.parentId === main.id)
                  return subs.length ? (
                    <optgroup key={main.id} label={main.name}>
                      <option value={main.id}>{main.name} (all)</option>
                      {subs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {main.name} › {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={main.id} value={main.id}>
                      {main.name}
                    </option>
                  )
                })}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Gender</span>
            <select value={v.gender} onChange={(e) => set({ gender: e.target.value as typeof v.gender })} className={selectClass}>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="unisex">Unisex</option>
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Status</span>
            <select value={v.status} onChange={(e) => set({ status: e.target.value as typeof v.status })} className={selectClass}>
              <option value="draft">Draft (hidden)</option>
              <option value="published">Published (in the shop)</option>
              <option value="archived">Archived (hidden, kept for history)</option>
            </select>
          </label>
          <label className="flex items-center gap-3 pt-6 text-sm text-king-muted">
            <input type="checkbox" checked={v.featured} onChange={(e) => set({ featured: e.target.checked })} className="size-4 accent-[#a30d0d]" />
            Featured (Latest drop &amp; collection hero)
          </label>
        </div>
      </Panel>

      <Panel title="Pricing (DA)">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {field("price", "Regular price", { type: "number" })}
          {field("salePrice", "Promo price (optional)", { type: "number" })}
          <div className="pt-6 text-sm text-king-muted">{discount ? `Promo: shown as −${discount}% on the product card.` : "No promo running."}</div>
        </div>
        <p className="mt-4 text-xs text-king-gray">
          This is the price on the product card. Colours without their own price use it (and its promo). A colour can have its own price and promo in
          “Colours, photos, prices &amp; stock” above.
        </p>
      </Panel>

      <Panel title="Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {field("shortDescription", "Short description", { area: true, rows: 2, max: 300 })}
          {field("description", "Full description", { area: true, rows: 4 })}
          {field("material", "Material / fabric", { area: true, rows: 2 })}
          {field("quality", "Quality information", { area: true, rows: 2 })}
          {field("fit", "Fit")}
          {field("style", "Style")}
          {field("collection", "Collection")}
          {field("care", "Care instructions", { area: true, rows: 2 })}
          {field("tags", "Tags (comma separated)", { hint: "Used by search and related products." })}
          {field("videoUrl", "Video URL (optional)")}
        </div>
      </Panel>

      <Panel title="Story">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {field("story", "Product story", { area: true, rows: 4 })}
          {field("inspiration", "History / inspiration", { area: true, rows: 4 })}
          {field("brandNote", "What it says about KING 253", { area: true, rows: 4 })}
        </div>
        <p className="mt-3 text-xs text-king-gray">Only write facts you can stand behind — no invented collaborations or endorsements.</p>
      </Panel>

      <Panel title="SEO">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {field("seoTitle", "SEO title", { max: 70, hint: "Defaults to the product name." })}
          {field("ogImageUrl", "Social preview image URL", { hint: "Defaults to the main photo." })}
          <div className="md:col-span-2">{field("seoDescription", "SEO description", { area: true, rows: 2, max: 170 })}</div>
        </div>
        <div className="mt-4 border border-white/10 p-4 text-sm">
          <p className="truncate text-king-white">{v.seoTitle || v.name || "Product title"} — KING 253</p>
          <p className="text-xs text-king-gray">/product/{v.slug || "…"}</p>
          <p className="mt-1 line-clamp-2 text-xs text-king-muted">{v.seoDescription || v.shortDescription || "Description shown in search results."}</p>
        </div>
      </Panel>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-4 border-t border-white/10 bg-king-black/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <button type="submit" disabled={pending} className={btnRed}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {productId ? "Save product" : "Create product"}
        </button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

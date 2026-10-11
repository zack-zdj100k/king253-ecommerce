"use client"

import * as React from "react"
import { CornerDownRight, Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { deleteCategoryAction, saveCategoryAction } from "@/app/admin/actions/products"
import { ConfirmButton } from "@/components/admin/confirm-button"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass, selectClass } from "@/components/admin/ui"

export type CategoryRow = {
  id: number
  name: string
  slug: string
  tagline: string | null
  parentId: number | null
  sortOrder: number
  active: boolean
  products: number
}

/** Main categories, each with its subcategories (Pants › Jeans, Baggy jeans, Classic…). */
export function CategoriesEditor({ categories }: { categories: CategoryRow[] }) {
  const mains = categories.filter((c) => c.parentId === null)
  const subsOf = (id: number) => categories.filter((c) => c.parentId === id)

  return (
    <div className="space-y-5">
      {mains.length === 0 && <p className="text-sm text-king-gray">No categories yet — add the first one below.</p>}
      {mains.map((main) => (
        <section key={main.id} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
          <div className="border-b border-white/[0.06] p-3 md:p-4">
            <CategoryForm category={main} mains={mains} hasChildren={subsOf(main.id).length > 0} />
          </div>
          <div className="space-y-2 p-3 md:p-4">
            {subsOf(main.id).map((sub) => (
              <div key={sub.id} className="flex items-start gap-2">
                <CornerDownRight className="mt-3 size-4 shrink-0 text-king-gray" aria-hidden />
                <div className="min-w-0 flex-1">
                  <CategoryForm category={sub} mains={mains} />
                </div>
              </div>
            ))}
            <AddSubcategory parent={main} />
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-dashed border-white/15 p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-king-white">
          <Plus className="size-4" aria-hidden /> New main category
        </p>
        <CategoryForm category={null} mains={mains} />
      </section>
    </div>
  )
}

function CategoryForm({ category, mains, hasChildren = false, parentId = null, onDone }: {
  category: CategoryRow | null
  mains: CategoryRow[]
  hasChildren?: boolean
  /** For a new subcategory. */
  parentId?: number | null
  onDone?: () => void
}) {
  const { run, pending, feedback } = useAdminAction()
  const blank = { name: "", slug: "", tagline: "", parentId: parentId === null ? "" : String(parentId), sortOrder: 0, active: true }
  const initial = category
    ? {
        name: category.name,
        slug: category.slug,
        tagline: category.tagline ?? "",
        parentId: category.parentId === null ? "" : String(category.parentId),
        sortOrder: category.sortOrder,
        active: category.active,
      }
    : blank
  const [v, setV] = React.useState(initial)
  const dirty = JSON.stringify(v) !== JSON.stringify(initial)
  const isSub = v.parentId !== ""

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveCategoryAction(category?.id ?? null, v), () => {
          if (!category) setV(blank)
          onDone?.()
        })
      }}
    >
      <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_70px]">
        <label className="block">
          <span className={cn(labelClass, category && "sr-only")}>{isSub ? "Subcategory name" : "Category name"}</span>
          <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={isSub ? "e.g. Baggy jeans" : "e.g. Pants"} aria-label="Name" className={cn(inputClass, !isSub && "font-semibold")} />
        </label>
        <label className="block">
          <span className={cn(labelClass, category && "sr-only")}>Slug</span>
          <input value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} placeholder="auto from name" aria-label="Slug" className={inputClass} />
        </label>
        <label className="block">
          <span className={cn(labelClass, category && "sr-only")}>Tagline</span>
          <input value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} placeholder="Tagline (optional)" aria-label="Tagline" className={inputClass} />
        </label>
        <label className="block">
          <span className={cn(labelClass, category && "sr-only")}>Belongs to</span>
          <select
            value={v.parentId}
            onChange={(e) => setV({ ...v, parentId: e.target.value })}
            disabled={hasChildren}
            aria-label="Belongs to"
            title={hasChildren ? "Has subcategories, so it stays a main category" : undefined}
            className={selectClass}
          >
            <option value="">Main category</option>
            {mains
              .filter((m) => m.id !== category?.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  Sub of {m.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block">
          <span className={cn(labelClass, category && "sr-only")}>Order</span>
          <input type="number" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })} aria-label="Order" className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-king-muted">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="accent-[#a30d0d]" /> Shown in the shop
        </label>
        {category && <span className="text-xs text-king-gray">· {category.products} product(s)</span>}
        <span className="flex-1" />
        <button type="submit" disabled={pending || !v.name.trim() || (category !== null && !dirty)} className={category ? `${btnOutline} h-9` : `${btnRed} h-9`}>
          {category ? "Save" : isSub ? "Add subcategory" : "Add category"}
        </button>
        {category && (
          <ConfirmButton
            danger
            disabled={pending}
            confirm={
              category.parentId === null
                ? hasChildren
                  ? "Delete? Subcategories become main categories."
                  : "Delete this category?"
                : "Delete this subcategory?"
            }
            confirmLabel="Yes, delete"
            onConfirm={() => run(() => deleteCategoryAction(category.id))}
            className={`${btnGhost} h-9`}
            ariaLabel={`Delete ${category.name}`}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </ConfirmButton>
        )}
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

function AddSubcategory({ parent }: { parent: CategoryRow }) {
  const [open, setOpen] = React.useState(false)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btnGhost} ml-6 h-8 text-xs`}>
        <Plus className="size-3.5" aria-hidden /> Add a subcategory to {parent.name}
      </button>
    )
  }
  return (
    <div className="ml-6 rounded-xl border border-dashed border-white/15 p-3">
      <CategoryForm category={null} mains={[parent]} parentId={parent.id} onDone={() => setOpen(false)} />
    </div>
  )
}

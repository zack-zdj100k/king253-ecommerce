"use client"

import * as React from "react"
import { GripVertical, Loader2, Star, Trash2, Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  addImagesAction,
  deleteImageAction,
  reorderImagesAction,
  setImageColourAction,
  setMainImageAction,
  updateImageAction,
} from "@/app/admin/actions/products"
import { ProductImage } from "@/components/shop/product-image"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, inputClass, labelClass, selectClass } from "@/components/admin/ui"
import { ConfirmButton } from "@/components/admin/confirm-button"

export type Img = { id: string; url: string; alt: string | null; color: string | null; isMain: boolean; focusX: number; focusY: number; zoom: number }

/**
 * Upload (drag & drop), reorder (drag), choose main, crop (focus/zoom),
 * assign to a colour, delete. `color` = the group being managed (null = photos
 * shown for every colour); uploads are tagged with it.
 */
export function ImagesManager({
  productId,
  images,
  color = null,
  colours = [],
  compact = false,
}: {
  productId: string
  images: Img[]
  color?: string | null
  colours?: string[]
  compact?: boolean
}) {
  const { run, pending, feedback, setFeedback } = useAdminAction()
  const [order, setOrder] = React.useState(images.map((i) => i.id))
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [over, setOver] = React.useState(false)
  const [editing, setEditing] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Keep local order in sync after server refreshes.
  const key = images.map((i) => i.id).join(",")
  const [syncedKey, setSyncedKey] = React.useState(key)
  if (key !== syncedKey) {
    setSyncedKey(key)
    setOrder(images.map((i) => i.id))
  }
  const byId = new Map(images.map((i) => [i.id, i]))
  const ordered = order.map((id) => byId.get(id)).filter((i): i is Img => !!i)

  async function upload(files: FileList | File[]) {
    const list = [...files].filter((f) => f.type.startsWith("image/"))
    if (!list.length) return
    setUploading(true)
    setFeedback(null)
    const form = new FormData()
    for (const f of list.slice(0, 12)) form.append("files", f)
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body: form })
      const body = (await res.json()) as { urls?: string[]; error?: string }
      if (!res.ok || !body.urls) throw new Error(body.error ?? "Upload failed.")
      run(() => addImagesAction(productId, body.urls!, color))
    } catch (e) {
      setFeedback({ tone: "error", text: e instanceof Error ? e.message : "Upload failed." })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          setOver(false)
          upload(e.dataTransfer.files)
        }}
        className={cn(
          "grid place-items-center rounded-2xl border border-dashed text-center transition-colors",
          compact ? "px-4 py-5" : "px-6 py-8",
          over ? "border-king-bright-red bg-king-red/10" : "border-white/20"
        )}
      >
        <Upload className={cn("text-king-gray", compact ? "size-5" : "size-6")} aria-hidden />
        <p className="mt-2 text-sm text-king-muted">{color ? `Drop ${color} photos here, or` : "Drop photos here, or"}</p>
        <button type="button" onClick={() => inputRef.current?.click()} className={`${btnOutline} mt-3`} disabled={uploading}>
          {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Choose files
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        {!compact && <p className="mt-2 text-xs text-king-gray">JPEG, PNG, WebP or AVIF · max 10 MB each · optimised automatically</p>}
      </div>

      {ordered.length > 0 && (
        <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", compact ? "lg:grid-cols-4 xl:grid-cols-6" : "lg:grid-cols-5")}>
          {ordered.map((img) => (
            <li
              key={img.id}
              draggable
              onDragStart={() => setDragging(img.id)}
              onDragEnd={() => {
                if (dragging) run(() => reorderImagesAction(productId, order))
                setDragging(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (!dragging || dragging === img.id) return
                setOrder((o) => {
                  const next = o.filter((x) => x !== dragging)
                  next.splice(next.indexOf(img.id), 0, dragging)
                  return next
                })
              }}
              className={cn("group overflow-hidden rounded-xl border bg-king-card", img.isMain ? "border-king-bright-red" : "border-white/10", dragging === img.id && "opacity-40")}
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <ProductImage image={img} alt={img.alt ?? ""} sizes="240px" />
                <span className="absolute top-1.5 left-1.5 grid size-7 cursor-grab place-items-center rounded-full bg-black/60 text-king-white" aria-hidden>
                  <GripVertical className="size-3.5" />
                </span>
                {img.isMain && <span className="absolute right-1.5 bottom-1.5 rounded-full bg-king-red px-2 py-1 text-xs font-medium text-king-white">Card photo</span>}
              </div>
              <div className="flex items-center justify-between gap-1 p-1">
                {!img.isMain ? (
                  <button type="button" onClick={() => run(() => setMainImageAction(productId, img.id))} className={btnGhost} title="Use as the product card photo" aria-label="Use as the product card photo">
                    <Star className="size-3.5" aria-hidden />
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" onClick={() => setEditing(editing === img.id ? null : img.id)} className={btnGhost}>
                  Crop
                </button>
                <ConfirmButton
                  danger
                  confirm="Remove?"
                  confirmLabel="Yes"
                  onConfirm={() => run(() => deleteImageAction(productId, img.id))}
                  className={btnGhost}
                  ariaLabel="Delete image"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </ConfirmButton>
              </div>
              {colours.length > 0 && (
                <div className="px-1.5 pb-1.5">
                  <select
                    value={img.color ?? ""}
                    onChange={(e) => run(() => setImageColourAction(productId, img.id, e.target.value || null))}
                    aria-label="Colour shown in this photo"
                    className={cn(selectClass, "h-8 rounded-full px-3 text-xs")}
                  >
                    <option value="">All colours</option>
                    {colours.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && byId.get(editing) && <CropEditor key={editing} productId={productId} image={byId.get(editing)!} onDone={() => setEditing(null)} />}
      {pending && <p className="text-xs text-king-gray">Saving…</p>}
      <Feedback feedback={feedback} />
    </div>
  )
}

function CropEditor({ productId, image, onDone }: { productId: string; image: Img; onDone: () => void }) {
  const { run, pending, feedback } = useAdminAction()
  const [v, setV] = React.useState({ alt: image.alt ?? "", focusX: image.focusX, focusY: image.focusY, zoom: image.zoom })
  return (
    <div className="grid gap-5 rounded-2xl border border-white/10 p-4 md:grid-cols-[200px_1fr]">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-king-card">
        <ProductImage image={{ url: image.url, ...v }} alt="" sizes="400px" />
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className={labelClass}>Alt text (describe the photo)</span>
          <input value={v.alt} onChange={(e) => setV({ ...v, alt: e.target.value })} className={inputClass} />
        </label>
        {(
          [
            ["focusX", "Focus — horizontal", 0, 100, 1],
            ["focusY", "Focus — vertical", 0, 100, 1],
            ["zoom", "Zoom", 1, 5, 0.1],
          ] as const
        ).map(([k, label, min, max, step]) => (
          <label key={k} className="block">
            <span className={labelClass}>
              {label} · {v[k]}
            </span>
            <input type="range" min={min} max={max} step={step} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} className="w-full accent-[#d41414]" />
          </label>
        ))}
        <div className="flex items-center gap-3">
          <button type="button" disabled={pending} onClick={() => run(() => updateImageAction(productId, image.id, v), onDone)} className={btnOutline}>
            Save crop
          </button>
          <button type="button" onClick={onDone} className={btnGhost}>
            Close
          </button>
          <Feedback feedback={feedback} />
        </div>
      </div>
    </div>
  )
}

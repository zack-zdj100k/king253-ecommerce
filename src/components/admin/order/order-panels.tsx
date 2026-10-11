"use client"

import * as React from "react"
import { Loader2, Plus, RotateCcw, Search, Trash2 } from "lucide-react"

import { formatDA } from "@/lib/money"
import {
  addItemAction,
  applyDiscountAction,
  changeStatusAction,
  removeItemAction,
  saveNotesAction,
  searchVariantsAction,
  updateDeliveryAction,
  updateItemAction,
} from "@/app/admin/actions/orders"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass, selectClass, textareaClass } from "@/components/admin/ui"
import { ConfirmButton } from "@/components/admin/confirm-button"

type Status = "pending" | "contacting" | "confirmed" | "preparing" | "ready_for_delivery" | "delivered" | "cancelled"
const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  contacting: "Contacting",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready_for_delivery: "Ready for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
}
const FLOW: Status[] = ["pending", "contacting", "confirmed", "preparing", "ready_for_delivery", "delivered"]

/* ------------------------------------------------------------------ */

export function StatusPanel({ orderId, status }: { orderId: string; status: Status }) {
  const { run, pending, feedback } = useAdminAction()
  const closed = status === "delivered" || status === "cancelled"
  const next = FLOW[FLOW.indexOf(status) + 1] as Status | undefined
  const [to, setTo] = React.useState<Status>(next ?? status)
  const [note, setNote] = React.useState("")

  if (closed) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-king-gray">This order is {STATUS_LABELS[status].toLowerCase()} and closed.</p>
        {status === "delivered" && (
          <a href="#returns" className={btnOutline}>
            <RotateCcw className="size-3.5" aria-hidden /> Return or exchange an item ↓
          </a>
        )}
      </div>
    )
  }
  const warning =
    to === "delivered"
      ? "Delivered removes the units from physical stock (and from reserved)."
      : to === "cancelled"
        ? "Cancelling releases the reservation. Physical stock is not changed."
        : "Reserved stock stays reserved."

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => changeStatusAction(orderId, to, note), () => setNote(""))
      }}
    >
      <div className="flex flex-wrap gap-2">
        {next && (
          <button type="button" onClick={() => setTo(next)} className={to === next ? btnRed : btnOutline}>
            → {STATUS_LABELS[next]}
          </button>
        )}
        <button type="button" onClick={() => setTo("cancelled")} className={to === "cancelled" ? btnRed : btnOutline}>
          Cancel order
        </button>
        <select value={to} onChange={(e) => setTo(e.target.value as Status)} aria-label="Any status" className={`${selectClass} w-auto`}>
          {[...FLOW, "cancelled" as Status].map((s) => (
            <option key={s} value={s} disabled={s === status}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the timeline (optional)" aria-label="Status note" className={inputClass} />
      <p className="text-xs text-king-gray">{warning}</p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || to === status} className={btnRed}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Set to {STATUS_LABELS[to]}
        </button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */

type Item = {
  id: string
  productName: string
  sku: string
  size: string
  color: string
  quantity: number
  unitPrice: number
  lineTotal: number
  removedAt: Date | null
  /** Null when the size/colour was deleted from the catalog. */
  variantId: string | null
  variants: { id: string; size: string; color: string; available: number; active: boolean }[]
}

export function ItemsPanel({ orderId, items, editable }: { orderId: string; items: Item[]; editable: boolean }) {
  const live = items.filter((i) => !i.removedAt)
  const removed = items.filter((i) => i.removedAt)
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-white/5">
        {live.map((item) => (
          <ItemRow key={item.id} orderId={orderId} item={item} editable={editable} canRemove={live.length > 1} />
        ))}
      </ul>
      {removed.length > 0 && (
        <p className="text-xs text-king-gray">
          Removed: {removed.map((i) => `${i.productName} (${i.color}/${i.size}) × ${i.quantity}`).join(", ")}
        </p>
      )}
      {editable && <AddItem orderId={orderId} />}
    </div>
  )
}

function ItemRow({ orderId, item, editable, canRemove }: { orderId: string; item: Item; editable: boolean; canRemove: boolean }) {
  const { run, pending, feedback } = useAdminAction()
  const [variantId, setVariantId] = React.useState(item.variantId ?? "")
  const [quantity, setQuantity] = React.useState(item.quantity)
  const dirty = variantId !== (item.variantId ?? "") || quantity !== item.quantity

  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-king-white">{item.productName}</p>
          <p className="text-xs text-king-gray">
            {item.sku} · {formatDA(item.unitPrice)} each
          </p>
        </div>
        <p className="text-king-white">{formatDA(item.lineTotal)}</p>
      </div>
      {editable && item.variantId ? (
        <div className="flex flex-wrap items-center gap-2">
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} aria-label="Size and colour" className={`${selectClass} w-auto min-w-44`}>
            {item.variants
              .filter((v) => v.active || v.id === item.variantId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.color} / {v.size} {v.id === item.variantId ? "(current)" : `— ${v.available} available`}
                </option>
              ))}
          </select>
          <input
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            aria-label="Quantity"
            className={`${inputClass} w-20`}
          />
          <button type="button" disabled={!dirty || pending} onClick={() => run(() => updateItemAction(orderId, item.id, variantId, quantity))} className={btnOutline}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Save
          </button>
          {canRemove && (
            <ConfirmButton
              danger
              disabled={pending}
              confirm="Remove from the order?"
              confirmLabel="Yes, remove"
              onConfirm={() => run(() => removeItemAction(orderId, item.id))}
              className={btnGhost}
            >
              <Trash2 className="size-3.5" aria-hidden /> Remove
            </ConfirmButton>
          )}
          <Feedback feedback={feedback} />
        </div>
      ) : (
        <p className="text-sm text-king-muted">
          {item.color} / {item.size} × {item.quantity}
        </p>
      )}
    </li>
  )
}

function AddItem({ orderId }: { orderId: string }) {
  const { run, pending, feedback } = useAdminAction()
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const [results, setResults] = React.useState<Awaited<ReturnType<typeof searchVariantsAction>>>([])
  const [qty, setQty] = React.useState(1)

  React.useEffect(() => {
    if (q.trim().length < 2) return
    const t = window.setTimeout(() => searchVariantsAction(q).then(setResults), 250)
    return () => window.clearTimeout(t)
  }, [q])

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnOutline}>
        <Plus className="size-3.5" aria-hidden /> Add item
      </button>
    )
  }
  return (
    <div className="space-y-3 border border-white/10 p-4">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-king-gray" aria-hidden />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product or SKU" aria-label="Search product or SKU" className={inputClass} />
        <input type="number" min={1} max={50} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} aria-label="Quantity" className={`${inputClass} w-20`} />
      </div>
      <ul className="max-h-60 divide-y divide-white/5 overflow-y-auto">
        {(q.trim().length < 2 ? [] : results).map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-king-muted">
              {v.name} — {v.color} / {v.size} <span className="text-king-gray">({v.available} available · {formatDA(v.price)})</span>
            </span>
            <button type="button" disabled={pending || v.available < qty} onClick={() => run(() => addItemAction(orderId, v.id, qty), () => setOpen(false))} className={btnOutline}>
              Add
            </button>
          </li>
        ))}
      </ul>
      <Feedback feedback={feedback} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function DiscountPanel({
  orderId,
  editable,
  current,
  subtotal,
}: {
  orderId: string
  editable: boolean
  current: { type: "fixed" | "percent" | null; value: number }
  subtotal: number
}) {
  const { run, pending, feedback } = useAdminAction()
  const [type, setType] = React.useState<"none" | "fixed" | "percent">(current.type ?? "none")
  const [value, setValue] = React.useState(String(current.value || ""))
  const amount = type === "percent" ? Math.round((subtotal * (Number(value) || 0)) / 100) : type === "fixed" ? Number(value) || 0 : 0
  if (!editable) return null
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => applyDiscountAction(orderId, type === "none" ? null : type, type === "none" ? 0 : Number(value) || 0))
      }}
    >
      <div className="grid grid-cols-[140px_1fr] gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Discount type" className={selectClass}>
          <option value="none">No discount</option>
          <option value="fixed">Fixed (DA)</option>
          <option value="percent">Percent (%)</option>
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} disabled={type === "none"} inputMode="numeric" aria-label="Discount value" className={inputClass} />
      </div>
      {type !== "none" && <p className="text-xs text-king-gray">= − {formatDA(amount)} on {formatDA(subtotal)}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnOutline}>Apply discount</button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */

export function DeliveryPanel({
  orderId,
  editable,
  current,
}: {
  orderId: string
  editable: boolean
  current: { wilaya: string; city: string; address: string; deliveryFee: number; freeDelivery: boolean }
}) {
  const { run, pending, feedback } = useAdminAction()
  const [v, setV] = React.useState({ wilaya: current.wilaya, city: current.city, address: current.address, fee: String(current.deliveryFee), free: current.freeDelivery })
  if (!editable) return null
  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => updateDeliveryAction(orderId, { wilaya: v.wilaya, city: v.city, address: v.address, deliveryFee: v.fee === "" ? 0 : v.fee, freeDelivery: v.free }))
      }}
    >
      <label className="block">
        <span className={labelClass}>Wilaya</span>
        <input value={v.wilaya} onChange={(e) => setV({ ...v, wilaya: e.target.value })} className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>City</span>
        <input value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} className={inputClass} />
      </label>
      <label className="block sm:col-span-2">
        <span className={labelClass}>Street / address</span>
        <input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Delivery fee (DA)</span>
        <input value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="0" className={inputClass} />
      </label>
      <label className="flex items-start gap-2 self-end pb-2 text-sm text-king-muted">
        <input type="checkbox" checked={v.free} onChange={(e) => setV({ ...v, free: e.target.checked })} className="mt-0.5 accent-[#a30d0d]" />
        <span>
          Free delivery
          <span className="block text-xs text-king-gray">The customer pays only the clothes; the shop pays the courier.</span>
        </span>
      </label>
      <div className="flex items-end gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={btnOutline}>Save delivery</button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */

export function NotesPanel({ orderId, notes }: { orderId: string; notes: string }) {
  const { run, pending, feedback } = useAdminAction()
  const [value, setValue] = React.useState(notes)
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveNotesAction(orderId, value))
      }}
    >
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="Internal notes — never shown to the customer" aria-label="Admin notes" className={textareaClass} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || value === notes} className={btnOutline}>Save notes</button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

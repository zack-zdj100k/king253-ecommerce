"use client"

import * as React from "react"
import { Loader2, Plus, RotateCcw, Search, Trash2 } from "lucide-react"

import { formatDA } from "@/lib/money"
import {
  addItemAction,
  applyDiscountAction,
  changeStatusAction,
  setStatusManuallyAction,
  removeItemAction,
  saveNotesAction,
  searchVariantsAction,
  updateDeliveryAction,
  updateItemAction,
} from "@/app/admin/actions/orders"
import { returnEverythingAction } from "@/app/admin/actions/returns"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass, selectClass, textareaClass } from "@/components/admin/ui"
import { ConfirmButton } from "@/components/admin/confirm-button"
import { ProductLine } from "@/components/admin/order/product-line"

type Status = "pending" | "contacting" | "confirmed" | "preparing" | "ready_for_delivery" | "delivered" | "cancelled"
const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  contacting: "Pending",
  confirmed: "Confirmed",
  preparing: "Confirmed",
  ready_for_delivery: "Confirmed",
  delivered: "Delivered",
  cancelled: "Cancelled",
}
/** Pending → Confirmed → Delivered (old in-between statuses continue from Confirmed). */
const NEXT: Partial<Record<Status, Status>> = {
  pending: "confirmed",
  contacting: "confirmed",
  confirmed: "delivered",
  preparing: "delivered",
  ready_for_delivery: "delivered",
}

/* ------------------------------------------------------------------ */

export function StatusPanel({ orderId, status, returned, hasReturns }: { orderId: string; status: Status; returned: boolean; hasReturns: boolean }) {
  const next = NEXT[status]
  if (!next) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-king-gray">
          {returned ? "Everything came back — this order is returned and out of revenue." : `This order is ${STATUS_LABELS[status].toLowerCase()} and closed.`}
        </p>
        {status === "delivered" && !returned && (
          <a href="#returns" className={btnOutline}>
            <RotateCcw className="size-3.5" aria-hidden /> Return or exchange ↓
          </a>
        )}
        <ManualStatus orderId={orderId} status={status} returned={returned} hasReturns={hasReturns} />
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <NextStep orderId={orderId} status={status} next={next} />
      <ManualStatus orderId={orderId} status={status} returned={returned} hasReturns={hasReturns} />
    </div>
  )
}

function NextStep({ orderId, status, next }: { orderId: string; status: Status; next: Status }) {
  const { run, pending, feedback } = useAdminAction()
  const [to, setTo] = React.useState<Status | null>(next)
  const [note, setNote] = React.useState("")
  const warning =
    to === "delivered"
      ? "Delivered: the units leave the shop's physical stock and the payment counts as collected."
      : to === "cancelled"
        ? "Cancelling releases the reserved units back to the shop. Not counted in revenue."
        : "The customer confirmed by phone. The units stay reserved in the departure shop."

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (to) run(() => changeStatusAction(orderId, to, note), () => setNote(""))
      }}
    >
      <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Order steps">
        {(["pending", "confirmed", "delivered"] as const).map((s, i) => {
          const done = ["pending", "confirmed", "delivered"].indexOf(STATUS_LABELS[status].toLowerCase()) >= i
          return (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-6 bg-white/15" aria-hidden />}
              <span className={done ? "text-king-white" : "text-king-gray"}>{STATUS_LABELS[s]}</span>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTo(next)} className={to === next ? btnRed : btnOutline}>
          → {STATUS_LABELS[next]}
        </button>
        <button type="button" onClick={() => setTo("cancelled")} className={to === "cancelled" ? btnRed : btnOutline}>
          Cancel order
        </button>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the timeline (optional)" aria-label="Status note" className={inputClass} />
      <p className="text-xs text-king-gray">{warning}</p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || !to} className={btnRed}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Set to {to ? STATUS_LABELS[to] : "…"}
        </button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

const MANUAL: { key: "pending" | "confirmed" | "delivered" | "cancelled" | "returned"; label: string; help: string }[] = [
  { key: "pending", label: "Pending", help: "Back to waiting for the phone call. The units are reserved in the shop." },
  { key: "confirmed", label: "Confirmed", help: "Confirmed with the customer. The units are reserved in the shop." },
  { key: "delivered", label: "Delivered", help: "The parcel was handed over: the units leave the shop and the payment counts as collected." },
  { key: "cancelled", label: "Cancelled", help: "Not sold: reserved units are released (a delivered parcel goes back on the shelf). Not counted in revenue." },
  { key: "returned", label: "Returned", help: "Everything the customer received comes back to the shop. The order leaves revenue." },
]
const REASONS = ["Refused at the door", "Wrong size", "Wrong colour", "Product issue", "Changed my mind", "Other"]

/** Any status, by hand — for mistakes and special cases. Stock always follows. */
function ManualStatus({ orderId, status, returned, hasReturns }: { orderId: string; status: Status; returned: boolean; hasReturns: boolean }) {
  const { run, pending, feedback } = useAdminAction()
  const current = returned ? "returned" : STATUS_LABELS[status].toLowerCase()
  const [to, setTo] = React.useState<(typeof MANUAL)[number]["key"] | null>(null)
  const [note, setNote] = React.useState("")
  const [reason, setReason] = React.useState(REASONS[0])
  const options = MANUAL.filter((o) => o.key !== current)
  // Recorded returns/exchanges keep the order Delivered; "Returned" needs a delivered order.
  const blocked = (key: string) =>
    (status === "delivered" && hasReturns && key !== "returned") || (key === "returned" && status !== "delivered")
  const choice = MANUAL.find((o) => o.key === to)

  return (
    <details className="group rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 open:pb-3">
      <summary className="cursor-pointer list-none py-1 text-sm font-medium text-king-muted hover:text-king-white">
        Change status by hand <span className="text-xs text-king-gray">— now: {current[0].toUpperCase() + current.slice(1)}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={blocked(o.key)}
              onClick={() => setTo(o.key)}
              className={to === o.key ? btnRed : btnOutline}
              title={blocked(o.key) ? (o.key === "returned" ? "Only a delivered order can be returned." : "This order has returns/exchanges recorded.") : o.help}
            >
              {o.label}
            </button>
          ))}
        </div>
        {status === "delivered" && hasReturns && (
          <p className="text-xs text-king-gray">Returns or exchanges are recorded on this order, so it can only become fully Returned.</p>
        )}
        {choice && (
          <>
            <p className="text-xs text-king-gray">{choice.help}</p>
            {choice.key === "returned" && (
              <label className="block">
                <span className={labelClass}>Reason</span>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass}>
                  {REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            )}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (optional, shown in the timeline)" aria-label="Note" className={inputClass} />
            <div className="flex flex-wrap items-center gap-3">
              <ConfirmButton
                disabled={pending}
                confirm={`Set this order to ${choice.label}?`}
                confirmLabel={`Yes, ${choice.label}`}
                onConfirm={() =>
                  run(
                    () => (choice.key === "returned" ? returnEverythingAction(orderId, reason, note) : setStatusManuallyAction(orderId, choice.key, note)),
                    () => {
                      setTo(null)
                      setNote("")
                    }
                  )
                }
                className={btnRed}
              >
                Set to {choice.label}
              </ConfirmButton>
              <Feedback feedback={feedback} />
            </div>
          </>
        )}
        {!choice && <Feedback feedback={feedback} />}
      </div>
    </details>
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
  view: { image: string | null; category: string | null; parentCategory: string | null; colorHex: string | null }
}
type Category = { id: number; name: string; parentId: number | null }

export function ItemsPanel({ orderId, items, editable, categories }: { orderId: string; items: Item[]; editable: boolean; categories: Category[] }) {
  const live = items.filter((i) => !i.removedAt)
  const removed = items.filter((i) => i.removedAt)
  return (
    <div className="space-y-4">
      <p className="text-xs text-king-gray">
        {live.length} product{live.length === 1 ? "" : "s"} · {live.reduce((n, i) => n + i.quantity, 0)} piece(s) chosen by the customer
      </p>
      <ul className="space-y-3">
        {live.map((item) => (
          <ItemRow key={item.id} orderId={orderId} item={item} editable={editable} canRemove={live.length > 1} />
        ))}
      </ul>
      {removed.length > 0 && (
        <p className="text-xs text-king-gray">
          Removed: {removed.map((i) => `${i.productName} (${i.color}/${i.size}) × ${i.quantity}`).join(", ")}
        </p>
      )}
      {editable && <AddItem orderId={orderId} categories={categories} />}
    </div>
  )
}

function ItemRow({ orderId, item, editable, canRemove }: { orderId: string; item: Item; editable: boolean; canRemove: boolean }) {
  const { run, pending, feedback } = useAdminAction()
  const [variantId, setVariantId] = React.useState(item.variantId ?? "")
  const [quantity, setQuantity] = React.useState(item.quantity)
  const dirty = variantId !== (item.variantId ?? "") || quantity !== item.quantity

  return (
    <li className="space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 md:p-4">
      <ProductLine
        line={{ ...item.view, name: item.productName, color: item.color, size: item.size, quantity: item.quantity }}
        aside={
          <>
            <p className="text-base font-semibold text-king-white tabular-nums">{formatDA(item.lineTotal)}</p>
            <p className="text-xs text-king-gray tabular-nums">
              {item.quantity} × {formatDA(item.unitPrice)}
            </p>
            <p className="mt-1 font-mono text-[0.7rem] text-king-gray">{item.sku}</p>
          </>
        }
      />
      {editable && item.variantId && (
        <div className="grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-[minmax(0,1fr)_96px] lg:grid-cols-[minmax(0,1fr)_96px_auto] lg:items-end">
          <label className="block">
            <span className={labelClass}>Change colour / size</span>
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={selectClass}>
              {item.variants
                .filter((v) => v.active || v.id === item.variantId)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.color} / {v.size} {v.id === item.variantId ? "(now)" : `— ${v.available} in this shop`}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Quantity</span>
            <input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className={inputClass}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1">
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
          </div>
          <div className="sm:col-span-full">
            <Feedback feedback={feedback} />
          </div>
        </div>
      )}
    </li>
  )
}

type Found = Awaited<ReturnType<typeof searchVariantsAction>>[number]

/** Add a product: pick a category (and subcategory) to browse, or type a name / SKU / barcode — or both. */
function AddItem({ orderId, categories }: { orderId: string; categories: Category[] }) {
  const { run, pending, feedback } = useAdminAction()
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const [main, setMain] = React.useState<number | null>(null)
  const [sub, setSub] = React.useState<number | null>(null)
  const [results, setResults] = React.useState<Found[]>([])
  const [loading, setLoading] = React.useState(false)
  const [qty, setQty] = React.useState<Record<string, number>>({})
  const mains = categories.filter((c) => c.parentId === null)
  const subs = main ? categories.filter((c) => c.parentId === main) : []
  const categoryId = sub ?? main
  const active = q.trim().length >= 2 || categoryId !== null

  React.useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => {
      setLoading(true)
      searchVariantsAction({ orderId, q, categoryId })
        .then(setResults)
        .finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(t)
  }, [orderId, q, categoryId, active])

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnOutline}>
        <Plus className="size-3.5" aria-hidden /> Add item
      </button>
    )
  }
  const chip = (on: boolean) =>
    `h-8 rounded-full border px-3 text-xs font-medium transition-colors ${on ? "border-king-bright-red/60 bg-king-red/15 text-king-white" : "border-white/10 text-king-muted hover:border-white/25 hover:text-king-white"}`
  const list = active ? results : []

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-king-white">Add a product to this order</p>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Close
        </button>
      </div>

      <div>
        <span className={labelClass}>Category</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => {
              setMain(null)
              setSub(null)
            }} className={chip(main === null)}>
            Any
          </button>
          {mains.map((c) => (
            <button key={c.id} type="button" onClick={() => {
                setMain(c.id)
                setSub(null)
              }} className={chip(main === c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      {subs.length > 0 && (
        <div>
          <span className={labelClass}>Subcategory</span>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setSub(null)} className={chip(sub === null)}>
              All {mains.find((c) => c.id === main)?.name}
            </button>
            {subs.map((c) => (
              <button key={c.id} type="button" onClick={() => setSub(c.id)} className={chip(sub === c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="block">
        <span className={labelClass}>Or type the name, SKU or barcode</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-king-gray" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. hoodie, KING-HOOD…" className={`${inputClass} pl-9`} />
        </span>
      </label>

      {!active && <p className="text-xs text-king-gray">Choose a category or type at least 2 letters.</p>}
      {active && loading && results.length === 0 && <p className="text-xs text-king-gray">Searching…</p>}
      {active && !loading && list.length === 0 && <p className="text-xs text-king-gray">Nothing found.</p>}

      {list.length > 0 && (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {list.map((v) => {
            const n = qty[v.id] ?? 1
            return (
              <li key={v.id} className={`rounded-xl border border-white/[0.07] p-3 ${v.available <= 0 ? "opacity-55" : ""}`}>
                <ProductLine
                  line={{ name: v.name, image: v.image, category: v.category, parentCategory: v.parentCategory, color: v.color, colorHex: v.colorHex, size: v.size, quantity: v.available }}
                  quantityLabel="In this shop"
                  aside={
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="text-sm font-semibold text-king-white tabular-nums">{v.price === null ? "—" : formatDA(v.price)}</span>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, v.available)}
                        value={n}
                        onChange={(e) => setQty({ ...qty, [v.id]: Math.max(1, Number(e.target.value) || 1) })}
                        aria-label={`Quantity of ${v.name} ${v.color} ${v.size}`}
                        className={`${inputClass} !h-9 !w-16 !px-2 text-center`}
                      />
                      <button
                        type="button"
                        disabled={pending || v.available < n}
                        onClick={() => run(() => addItemAction(orderId, v.id, n), () => setOpen(false))}
                        className={btnRed}
                      >
                        <Plus className="size-3.5" aria-hidden /> Add
                      </button>
                    </div>
                  }
                />
              </li>
            )
          })}
        </ul>
      )}
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

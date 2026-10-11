"use client"

import * as React from "react"
import { RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"
import { createReturnAction } from "@/app/admin/actions/moderation"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass, pill, selectClass, textareaClass } from "@/components/admin/ui"

const REASONS = ["Wrong size", "Wrong colour", "Product issue", "Changed my mind", "Other"]

type Item = {
  id: string
  name: string
  size: string
  color: string
  variantId: string | null
  /** Units of this line not yet covered by a return request. */
  returnable: number
  /** Other sizes/colours of the same product (for exchanges). */
  options: { id: string; size: string; color: string; available: number; active: boolean }[]
}

/**
 * The shop records a return or exchange for a delivered order (customer came
 * back to the shop or called). Stock only moves at "Received" / "Complete".
 */
export function AdminReturnForm({ orderId, items }: { orderId: string; items: Item[] }) {
  const { run, pending, feedback, setFeedback } = useAdminAction()
  const returnable = items.filter((i) => i.returnable > 0)
  const [open, setOpen] = React.useState(false)
  const [v, setV] = React.useState({
    itemId: returnable[0]?.id ?? "",
    type: "exchange" as "return" | "exchange",
    quantity: 1,
    reason: REASONS[0],
    details: "",
    replacementVariantId: "",
    approve: true,
  })
  const item = returnable.find((i) => i.id === v.itemId) ?? returnable[0]
  const options = item?.options.filter((o) => o.active && o.id !== item.variantId) ?? []

  if (!returnable.length) {
    return <p className="text-sm text-king-gray">Every item of this order is already covered by a return or exchange.</p>
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnOutline}>
        <RotateCcw className="size-3.5" aria-hidden /> Record a return or exchange
      </button>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!item) return
        if (v.type === "exchange" && !v.replacementVariantId) return setFeedback({ tone: "error", text: "Choose the size or colour the customer takes instead." })
        run(
          () =>
            createReturnAction(orderId, {
              orderItemId: item.id,
              type: v.type,
              quantity: v.quantity,
              reason: v.reason,
              details: v.details,
              replacementVariantId: v.type === "exchange" ? v.replacementVariantId : null,
              approve: v.approve,
            }),
          () => setOpen(false)
        )
      }}
    >
      <div className="flex flex-wrap gap-2">
        {(["exchange", "return"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setV({ ...v, type: t })} className={pill(v.type === t)} aria-pressed={v.type === t}>
            {t === "exchange" ? "Exchange (other size / colour)" : "Return (give the item back)"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
        <label className="block">
          <span className={labelClass}>Item</span>
          <select
            value={item?.id}
            onChange={(e) => setV({ ...v, itemId: e.target.value, quantity: 1, replacementVariantId: "" })}
            className={selectClass}
          >
            {returnable.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.color} / {i.size}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Quantity (max {item?.returnable})</span>
          <input
            type="number"
            min={1}
            max={item?.returnable}
            value={v.quantity}
            onChange={(e) => setV({ ...v, quantity: Math.max(1, Math.min(item?.returnable ?? 1, Number(e.target.value) || 1)) })}
            className={inputClass}
          />
        </label>
      </div>

      {v.type === "exchange" && (
        <label className="block">
          <span className={labelClass}>Customer takes instead</span>
          <select value={v.replacementVariantId} onChange={(e) => setV({ ...v, replacementVariantId: e.target.value })} className={selectClass}>
            <option value="">Choose size / colour…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id} disabled={o.available <= 0}>
                {o.color} / {o.size} — {o.available > 0 ? `${o.available} available` : "out of stock"}
              </option>
            ))}
          </select>
          {options.length === 0 && <span className="mt-1 block text-xs text-king-bright-red">No other size or colour of this product is on sale.</span>}
        </label>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Reason</span>
          <select value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} className={selectClass}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Details (optional)</span>
          <textarea value={v.details} onChange={(e) => setV({ ...v, details: e.target.value })} rows={1} className={cn(textareaClass, "min-h-10 py-2")} />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-king-muted">
        <input type="checkbox" checked={v.approve} onChange={(e) => setV({ ...v, approve: e.target.checked })} className="mt-0.5 accent-[#a30d0d]" />
        <span>
          Approve now{v.type === "exchange" ? " — the replacement is reserved straight away" : ""}.
          <span className="block text-xs text-king-gray">Then mark it “Received” when the item is back (resellable items go back into stock) and “Complete”.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={btnRed}>
          Record {v.type}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Cancel
        </button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

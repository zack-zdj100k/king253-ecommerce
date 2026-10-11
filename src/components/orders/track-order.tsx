"use client"

import * as React from "react"
import { Loader2, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"
import { requestReturnAction, trackOrderAction, type TrackResult } from "@/app/actions/orders"
import type { CustomerOrderView } from "@/server/orders/view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OrderSummary } from "@/components/orders/order-summary"
import { OrderTimeline } from "@/components/orders/order-timeline"
import { CancelOrder } from "@/components/orders/cancel-order"
import { OrderReturns } from "@/components/orders/order-returns"

const REASONS = ["Wrong size", "Wrong colour", "Product issue", "Changed my mind", "Other"] as const
const fieldClass =
  "h-12 rounded-[6px] border-white/12 bg-black/40 px-4 text-base text-king-white placeholder:text-king-gray/70 focus-visible:border-king-bright-red focus-visible:ring-2 focus-visible:ring-king-bright-red/25 md:text-sm dark:bg-black/40"

export function TrackOrder({ initialNumber }: { initialNumber: string }) {
  const [number, setNumber] = React.useState(initialNumber)
  const [phone, setPhone] = React.useState("")
  const [result, setResult] = React.useState<TrackResult | null>(null)
  const [pending, startTransition] = React.useTransition()

  return (
    <div className="space-y-12">
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          startTransition(async () => setResult(await trackOrderAction({ number, phone })))
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="track-number" className="text-sm text-king-white">Order number</Label>
          <Input id="track-number" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="KING253-20261004-001" required className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="track-phone" className="text-sm text-king-white">Phone used for the order</Label>
          <Input id="track-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="05 / 06 / 07 …" required className={fieldClass} />
        </div>
        <Button type="submit" variant="king" size="xl" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Track
        </Button>
      </form>

      {result && !result.ok && (
        <p role="alert" className="border border-king-red-line bg-king-red/10 p-4 text-sm text-king-white">
          {result.error}
        </p>
      )}

      {result?.ok && <TrackedOrder order={result.order} phone={result.phone} onUpdate={setResult} />}
    </div>
  )
}

function TrackedOrder({ order, phone, onUpdate }: { order: CustomerOrderView; phone: string; onUpdate: (r: TrackResult) => void }) {
  const returnable = order.items.filter((i) => i.returnable > 0)
  return (
    <div className="space-y-12">
      <div>
        <p className="king-label text-[0.6rem] text-king-gray">Order</p>
        <p className="king-display mt-2 text-4xl text-king-white">{order.number}</p>
        <p className="mt-2 text-sm text-king-gray">Placed {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <OrderTimeline order={order} />
      <div className="border-t border-white/10 pt-10">
        <OrderSummary order={order} />
      </div>

      <OrderReturns order={order} />

      {returnable.length > 0 && <ReturnForm order={order} phone={phone} items={returnable} onUpdate={onUpdate} />}

      {order.status !== "delivered" && (
        <div className="border-t border-white/10 pt-10">
          <CancelOrder order={order} phone={phone} onCancelled={(o) => onUpdate({ ok: true, order: o, phone })} />
        </div>
      )}
    </div>
  )
}

function ReturnForm({
  order,
  phone,
  items,
  onUpdate,
}: {
  order: CustomerOrderView
  phone: string
  items: CustomerOrderView["items"]
  onUpdate: (r: TrackResult) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [itemId, setItemId] = React.useState(items[0].id)
  const [type, setType] = React.useState<"exchange" | "return">("exchange")
  const [reason, setReason] = React.useState<(typeof REASONS)[number]>("Wrong size")
  const [quantity, setQuantity] = React.useState(1)
  const [replacement, setReplacement] = React.useState("")
  const [details, setDetails] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const item = items.find((i) => i.id === itemId) ?? items[0]

  if (done) return <p className="border border-white/10 p-5 text-sm text-king-muted" role="status">Request sent. We&apos;ll contact you to arrange the {type}.</p>
  if (!open) {
    return (
      <Button variant="kingOutline" size="xl" onClick={() => setOpen(true)}>
        <RotateCcw className="size-4" aria-hidden /> Return or exchange an item
      </Button>
    )
  }

  return (
    <form
      className="king-chamfer space-y-5 border border-white/10 bg-king-near-black p-6 [--cut:18px]"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const r = await requestReturnAction({
            number: order.number,
            phone,
            orderItemId: item.id,
            type,
            reason,
            details,
            quantity,
            replacementVariantId: type === "exchange" ? replacement || null : null,
          })
          if (r.ok) {
            setDone(true)
            onUpdate(r)
          } else setError(r.error)
        })
      }}
    >
      <h2 className="king-label text-king-white">Return or exchange</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-king-white">
          Item
          <select value={itemId} onChange={(e) => { setItemId(e.target.value); setReplacement(""); setQuantity(1) }} className={cn(fieldClass, "w-full appearance-none border")}>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.color} / {i.size}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm text-king-white">
          Quantity
          <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={cn(fieldClass, "w-full appearance-none border")}>
            {Array.from({ length: item.returnable }, (_, n) => n + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex gap-3">
        {(["exchange", "return"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={cn("king-label h-11 flex-1 border text-[0.6rem]", type === t ? "border-king-bright-red bg-king-red/15 text-king-white" : "border-white/15 text-king-muted")}>
            {t === "exchange" ? "Exchange (size / colour)" : "Return"}
          </button>
        ))}
      </fieldset>
      {type === "exchange" && (
        <label className="block space-y-2 text-sm text-king-white">
          Replace with
          <select value={replacement} onChange={(e) => setReplacement(e.target.value)} required className={cn(fieldClass, "w-full appearance-none border")}>
            <option value="">{item.exchangeOptions.length ? "Choose…" : "No other size in stock right now"}</option>
            {item.exchangeOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block space-y-2 text-sm text-king-white">
        Reason
        <select value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])} className={cn(fieldClass, "w-full appearance-none border")}>
          {REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="block space-y-2 text-sm text-king-white">
        Details (optional)
        <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} rows={3} className="w-full rounded-[6px] border border-white/12 bg-black/40 p-3 text-sm text-king-white focus-visible:border-king-bright-red focus-visible:outline-none" />
      </label>
      {error && <p role="alert" className="text-sm text-king-bright-red">{error}</p>}
      <Button type="submit" variant="king" size="xl" disabled={pending || (type === "exchange" && !replacement)}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  )
}

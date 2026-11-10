"use client"

import * as React from "react"
import { ArrowLeftRight, Minus, Plus, RotateCcw, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import { recordExchangeAction, recordReturnAction } from "@/app/admin/actions/returns"
import { ProductLine } from "@/components/admin/order/product-line"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass, segment, segmentTrack, selectClass, textareaClass } from "@/components/admin/ui"

type Item = {
  id: string
  name: string
  size: string
  color: string
  left: number
  unitValue: number
  fromExchange: boolean
  view: { image: string | null; category: string | null; parentCategory: string | null; colorHex: string | null }
}
type Shop = { id: number; name: string }
type Option = { variantId: string; label: string; price: number; stock: { storeId: number; available: number }[] }

const REASONS = ["Wrong size", "Wrong colour", "Product issue", "Changed my mind", "Other"]

/**
 * Return or Exchange on a delivered order, done in one step by the shop:
 * stock, money difference and the journal entry are saved together.
 */
export function ReturnExchangePanel({
  orderId,
  items,
  shops,
  orderShopId,
  catalog,
}: {
  orderId: string
  items: Item[]
  shops: Shop[]
  orderShopId: number | null
  catalog: Option[]
}) {
  const { run, pending, feedback } = useAdminAction()
  const [mode, setMode] = React.useState<"return" | "exchange">("return")
  const [qty, setQty] = React.useState<Record<string, number>>({})
  const [storeId, setStoreId] = React.useState<number | null>(orderShopId ?? shops[0]?.id ?? null)
  const [added, setAdded] = React.useState<{ variantId: string; quantity: number }[]>([])
  const [pick, setPick] = React.useState("")
  const [reason, setReason] = React.useState(REASONS[0])
  const [note, setNote] = React.useState("")

  const returned = items.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ orderItemId: i.id, quantity: qty[i.id] }))
  const returnedValue = items.reduce((s, i) => s + (qty[i.id] ?? 0) * i.unitValue, 0)
  const stockIn = (o: Option | undefined) => o?.stock.find((s) => s.storeId === storeId)?.available ?? 0
  const newValue = added.reduce((s, a) => s + (catalog.find((o) => o.variantId === a.variantId)?.price ?? 0) * a.quantity, 0)
  const difference = newValue - returnedValue
  const tooMuch = added.some((a) => a.quantity > stockIn(catalog.find((o) => o.variantId === a.variantId)))
  const canSave = returned.length > 0 && storeId !== null && (mode === "return" || (added.length > 0 && !tooMuch))
  const reset = () => {
    setQty({})
    setAdded([])
    setNote("")
  }

  if (!items.length) return <p className="text-sm text-king-gray">Every item of this order has already come back.</p>

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave) return
        const base = { orderId, storeId, returned, reason, note }
        run(() => (mode === "return" ? recordReturnAction(base) : recordExchangeAction({ ...base, added })), reset)
      }}
    >
      <div className={segmentTrack} role="tablist" aria-label="Return or exchange">
        <button type="button" role="tab" aria-selected={mode === "return"} onClick={() => setMode("return")} className={segment(mode === "return")}>
          <RotateCcw className="size-3.5" aria-hidden /> Return
        </button>
        <button type="button" role="tab" aria-selected={mode === "exchange"} onClick={() => setMode("exchange")} className={segment(mode === "exchange")}>
          <ArrowLeftRight className="size-3.5" aria-hidden /> Exchange
        </button>
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Which products come back? Use + to choose how many of each</legend>
        <ul className="space-y-2">
          {items.map((i) => {
            const n = qty[i.id] ?? 0
            const set = (v: number) => setQty({ ...qty, [i.id]: Math.max(0, Math.min(i.left, v)) })
            return (
              <li key={i.id} className={cn("rounded-xl border p-3 transition-colors", n ? "border-king-bright-red/50 bg-king-red/10" : "border-white/[0.08]")}>
                <ProductLine
                  line={{ ...i.view, name: i.name, color: i.color, size: i.size, quantity: i.left }}
                  quantityLabel="Can come back"
                  badge={i.fromExchange ? <span className="mb-1 inline-flex rounded-full bg-emerald-400/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-200">From an exchange</span> : null}
                  aside={
                    <div className="space-y-1">
                      <p className="text-xs text-king-gray">Paid {formatDA(i.unitValue)} each</p>
                      <div className="flex items-center gap-1 sm:justify-end">
                        <span className="mr-1 text-xs font-medium text-king-muted">Coming back</span>
                        <button type="button" onClick={() => set(n - 1)} disabled={!n} className={btnGhost} aria-label={`One less ${i.name}`}>
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-7 text-center text-base font-semibold tabular-nums text-king-white">{n}</span>
                        <button type="button" onClick={() => set(n + 1)} disabled={n >= i.left} className={btnGhost} aria-label={`One more ${i.name}`}>
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  }
                />
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className={labelClass}>{mode === "return" ? "Back into the stock of" : "Shop of the exchange (stock in and out)"}</span>
          <select value={storeId ?? ""} onChange={(e) => setStoreId(Number(e.target.value) || null)} className={selectClass}>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.id === orderShopId ? " (shipped from)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>

      {mode === "exchange" && (
        <fieldset className="space-y-2">
          <legend className={labelClass}>What the customer gets instead (any product and size in stock)</legend>
          <div className="flex flex-wrap gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${selectClass} min-w-0 flex-1`} aria-label="New item">
              <option value="">Choose a product, colour and size…</option>
              {catalog.map((o) => {
                const n = stockIn(o)
                return (
                  <option key={o.variantId} value={o.variantId} disabled={n <= 0}>
                    {o.label} · {formatDA(o.price)} · {n > 0 ? `${n} in stock` : "out of stock here"}
                  </option>
                )
              })}
            </select>
            <button
              type="button"
              disabled={!pick}
              className={btnOutline}
              onClick={() => {
                setAdded(added.some((a) => a.variantId === pick) ? added.map((a) => (a.variantId === pick ? { ...a, quantity: a.quantity + 1 } : a)) : [...added, { variantId: pick, quantity: 1 }])
                setPick("")
              }}
            >
              <Plus className="size-3.5" aria-hidden /> Add
            </button>
          </div>
          {added.length > 0 && (
            <ul className="space-y-2">
              {added.map((a) => {
                const o = catalog.find((x) => x.variantId === a.variantId)
                const n = stockIn(o)
                return (
                  <li key={a.variantId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] p-3 text-sm">
                    <span>
                      <span className="block text-king-white">{o?.label}</span>
                      <span className={cn("text-xs", a.quantity > n ? "text-king-bright-red" : "text-king-gray")}>
                        {formatDA(o?.price ?? 0)} each · {n} in stock in this shop
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={n}
                        value={a.quantity}
                        onChange={(e) => setAdded(added.map((x) => (x.variantId === a.variantId ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))}
                        className={`${inputClass} !h-9 !w-16 !px-2 text-center`}
                        aria-label="Quantity"
                      />
                      <button type="button" onClick={() => setAdded(added.filter((x) => x.variantId !== a.variantId))} className={btnGhost} aria-label="Remove">
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </fieldset>
      )}

      <label className="block">
        <span className={labelClass}>Note (optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={textareaClass} />
      </label>

      <div className="rounded-xl bg-white/[0.03] p-3 text-sm">
        {mode === "return" ? (
          <p className="flex justify-between">
            <span className="text-king-gray">To refund the customer</span>
            <span className="font-semibold text-king-white">{formatDA(returnedValue)}</span>
          </p>
        ) : (
          <>
            <p className="flex justify-between text-king-gray">
              <span>New items</span>
              <span>{formatDA(newValue)}</span>
            </p>
            <p className="flex justify-between text-king-gray">
              <span>Returned items</span>
              <span>− {formatDA(returnedValue)}</span>
            </p>
            <p className="mt-1 flex justify-between border-t border-white/10 pt-1 font-semibold">
              <span className={difference >= 0 ? "text-emerald-300" : "text-king-bright-red"}>
                {difference > 0 ? "To collect" : difference < 0 ? "To refund" : "No difference"}
              </span>
              <span className="text-king-white">{formatDA(Math.abs(difference))}</span>
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !canSave} className={btnRed}>
          {mode === "return" ? "Record return" : "Record exchange"}
        </button>
        {tooMuch && <span className="text-xs text-king-bright-red">Not enough stock in this shop for a new item.</span>}
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

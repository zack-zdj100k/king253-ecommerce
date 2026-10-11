"use client"

import * as React from "react"
import { PackagePlus, SlidersHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { adjustStockAction, receiveStockAction } from "@/app/admin/actions/products"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnRed, inputClass } from "@/components/admin/ui"

const REASONS = ["Stock count correction", "Damaged / lost", "Returned to supplier", "New delivery", "Other"]

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-king-bright-red/40"

/**
 * Stock can be changed at any time, two ways — both recorded in the stock ledger:
 *   • Add stock: units that just arrived are added on top (e.g. +20).
 *   • Set count: physical stock is set to what was counted on the shelf.
 */
export function StockAdjust({ variantId, physical, reserved }: { variantId: string; physical: number; reserved: number }) {
  const [mode, setMode] = React.useState<"add" | "set" | null>(null)

  if (!mode) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setMode("add")} className={cn(chip, "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20")}>
          <PackagePlus className="size-3.5" aria-hidden /> Add stock
        </button>
        <button type="button" onClick={() => setMode("set")} className={cn(chip, "border-white/10 text-king-muted hover:border-white/25 hover:text-king-white")}>
          <SlidersHorizontal className="size-3.5" aria-hidden /> Set count
        </button>
      </div>
    )
  }
  return mode === "add" ? (
    <AddStock variantId={variantId} physical={physical} onDone={() => setMode(null)} />
  ) : (
    <SetCount variantId={variantId} physical={physical} reserved={reserved} onDone={() => setMode(null)} />
  )
}

function AddStock({ variantId, physical, onDone }: { variantId: string; physical: number; onDone: () => void }) {
  const { run, pending, feedback } = useAdminAction()
  const [qty, setQty] = React.useState("")
  const [note, setNote] = React.useState("")
  const n = Number(qty)
  const valid = Number.isInteger(n) && n >= 1

  return (
    <form
      className="mt-2 space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) run(() => receiveStockAction(variantId, n, note), onDone)
      }}
    >
      <p className="text-xs font-medium text-emerald-200">Units received</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {[5, 10, 20].map((step) => (
            <button key={step} type="button" onClick={() => setQty(String((valid ? n : 0) + step))} className={cn(chip, "h-9 border-white/10 text-king-muted hover:text-king-white")}>
              +{step}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Quantity"
          aria-label="Units received"
          autoFocus
          className={`${inputClass} w-28`}
        />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" className={`${inputClass} w-40`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || !valid} className={btnRed}>
          Add {valid ? `+${n}` : ""}
        </button>
        <button type="button" onClick={onDone} className={btnGhost}>
          Cancel
        </button>
        {valid && <span className="text-xs text-king-gray">Physical stock {physical} → {physical + n}</span>}
      </div>
      <Feedback feedback={feedback} />
    </form>
  )
}

function SetCount({ variantId, physical, reserved, onDone }: { variantId: string; physical: number; reserved: number; onDone: () => void }) {
  const { run, pending, feedback } = useAdminAction()
  const [value, setValue] = React.useState(String(physical))
  const [reason, setReason] = React.useState(REASONS[0])
  const [detail, setDetail] = React.useState("")
  const next = Number(value)
  const invalid = value === "" || !Number.isInteger(next) || next < reserved

  return (
    <form
      className="mt-2 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => adjustStockAction(variantId, next, detail ? `${reason}: ${detail}` : reason), onDone)
      }}
    >
      <p className="text-xs font-medium text-king-muted">Counted on the shelf</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={reserved} value={value} onChange={(e) => setValue(e.target.value)} aria-label="New physical stock" autoFocus className={`${inputClass} w-24`} />
        <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" className={`${inputClass} w-auto`}>
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Details (optional)" aria-label="Details" className={`${inputClass} w-40`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || invalid || next === physical} className={btnRed}>
          Save count
        </button>
        <button type="button" onClick={onDone} className={btnGhost}>
          Cancel
        </button>
        {invalid ? (
          <span className="text-xs text-king-bright-red">Can&apos;t go below the {reserved} unit(s) reserved for open orders.</span>
        ) : next !== physical ? (
          <span className="text-xs text-king-gray">Physical stock {physical} → {next}</span>
        ) : null}
      </div>
      <Feedback feedback={feedback} />
    </form>
  )
}

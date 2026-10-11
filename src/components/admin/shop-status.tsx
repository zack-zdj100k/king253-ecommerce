"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { saveSettingsAction } from "@/app/admin/actions/site"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnOutline, btnRed, inputClass, labelClass, Panel, pill, textareaClass } from "@/components/admin/ui"

/* Algeria is UTC+1 all year (no daylight saving), so the inputs work in that time on every machine. */
const DZ_OFFSET_MS = 3_600_000
const isoToInput = (iso: string) => (iso ? new Date(new Date(iso).getTime() + DZ_OFFSET_MS).toISOString().slice(0, 16) : "")
const inputToIso = (v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : "")
/** Today + n days at 10:00 Algeria time, as an input value. */
const daysFromNow = (n: number) => {
  const d = new Date(Date.now() + DZ_OFFSET_MS + n * 86_400_000)
  return `${d.toISOString().slice(0, 10)}T10:00`
}

export type ShopStatusProps = {
  values: { shopClosed: boolean; closedFrom: string; closedUntil: string; closedMessage: string }
  /** Computed on the server (single source of truth for "now"). */
  status: { state: "open" | "closed" | "scheduled"; from: string | null; until: string | null }
}

export function ShopStatus({ values, status }: ShopStatusProps) {
  const { run, pending, feedback, setFeedback } = useAdminAction()
  const [closed, setClosed] = React.useState(values.shopClosed)
  const [from, setFrom] = React.useState(isoToInput(values.closedFrom))
  const [until, setUntil] = React.useState(isoToInput(values.closedUntil))
  const [message, setMessage] = React.useState(values.closedMessage)

  const save = (next: { shopClosed: boolean }) => {
    if (next.shopClosed && from && until && until <= from) {
      setFeedback({ tone: "error", text: "The reopening date must be after the closing date." })
      return
    }
    run(() =>
      saveSettingsAction({
        shopClosed: next.shopClosed,
        closedFrom: next.shopClosed ? inputToIso(from) : "",
        closedUntil: next.shopClosed ? inputToIso(until) : "",
        closedMessage: message,
      })
    )
    if (!next.shopClosed) {
      setClosed(false)
      setFrom("")
      setUntil("")
    }
  }

  const tone = status.state === "closed" ? "bg-[#ff453a]" : status.state === "scheduled" ? "bg-[#ff9f0a]" : "bg-[#30d158]"

  return (
    <div id="shop-status" className="scroll-mt-24">
      <Panel title="Shop status">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={cn("size-3 rounded-full", tone, status.state !== "open" && "animate-pulse motion-reduce:animate-none")} aria-hidden />
            <div>
              <p className="text-[17px] font-semibold text-white">
                {status.state === "open" ? "Open — customers can order" : status.state === "closed" ? "Closed to visitors" : "Closure scheduled"}
              </p>
              <p className="text-[13px] text-[var(--ios-label-2)]">
                {status.state === "closed" && (status.until ? `Reopens automatically on ${status.until}.` : "Stays closed until you reopen it.")}
                {status.state === "scheduled" && `Closes on ${status.from}${status.until ? `, reopens on ${status.until}` : ""}.`}
                {status.state === "open" && "Use this for holidays or a break: the site closes and reopens on its own."}
              </p>
            </div>
          </div>
          {status.state !== "open" && (
            <button type="button" disabled={pending} onClick={() => save({ shopClosed: false })} className={btnOutline}>
              Reopen now
            </button>
          )}
        </div>

        <form
          className="mt-6 space-y-5 border-t border-[var(--ios-sep)] pt-6"
          onSubmit={(e) => {
            e.preventDefault()
            save({ shopClosed: closed })
          }}
        >
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-[15px] font-medium text-white">Close the shop (vacation mode)</span>
              <span className="block text-[13px] text-[var(--ios-label-2)]">Visitors see a “We’ll be back” page and can’t order. You keep full access to the admin.</span>
            </span>
            <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} aria-label="Close the shop" />
          </label>

          <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", !closed && "pointer-events-none opacity-40")} aria-disabled={!closed}>
            <label className="block">
              <span className={labelClass}>Closes on (Algeria time)</span>
              <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(inputClass, "[color-scheme:dark]")} disabled={!closed} />
              <span className="mt-1 block pl-1 text-[12px] text-[var(--ios-label-2)]">Empty = right away.</span>
            </label>
            <label className="block">
              <span className={labelClass}>Reopens on (Algeria time)</span>
              <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={cn(inputClass, "[color-scheme:dark]")} disabled={!closed} />
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                {[1, 3, 7, 15].map((n) => (
                  <button key={n} type="button" disabled={!closed} onClick={() => setUntil(daysFromNow(n))} className={pill(false)}>
                    +{n} {n === 1 ? "day" : "days"}
                  </button>
                ))}
                <button type="button" disabled={!closed} onClick={() => setUntil("")} className={pill(false)}>
                  Until I reopen
                </button>
              </span>
            </label>
            <label className="block md:col-span-2">
              <span className={labelClass}>Message for visitors (optional)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="The shop is taking a short break. Orders are paused for now — thank you for your patience."
                className={textareaClass}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={btnRed}>
              Save shop status
            </button>
            <Feedback feedback={feedback} />
          </div>
        </form>
      </Panel>
    </div>
  )
}

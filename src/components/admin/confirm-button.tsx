"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Two-step button confirmed inside the page. Browser pop-ups (window.confirm)
 * are silently blocked in some browsers and in-app web views, which made
 * buttons look dead — so confirmation always happens here instead.
 */
export function ConfirmButton({
  children,
  confirm,
  confirmLabel = "Yes",
  onConfirm,
  className,
  disabled,
  danger = false,
  ariaLabel,
}: {
  children: React.ReactNode
  /** Short question shown before the final click. */
  confirm: string
  confirmLabel?: string
  onConfirm: () => void
  /** Classes for the first (trigger) button. */
  className?: string
  disabled?: boolean
  danger?: boolean
  ariaLabel?: string
}) {
  const [asking, setAsking] = React.useState(false)

  React.useEffect(() => {
    if (!asking) return
    const t = window.setTimeout(() => setAsking(false), 8000)
    return () => window.clearTimeout(t)
  }, [asking])

  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} aria-label={ariaLabel} title={ariaLabel} className={className}>
        {children}
      </button>
    )
  }
  return (
    <span
      role="group"
      aria-label={confirm}
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 rounded-full border py-1 pr-1 pl-3",
        danger ? "border-king-bright-red/25 bg-king-red/10" : "border-white/15 bg-white/[0.05]"
      )}
    >
      <span className="text-xs whitespace-nowrap text-king-white">{confirm}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
        className={cn(
          "inline-flex h-8 items-center rounded-full px-3.5 text-xs font-medium text-king-white transition-colors disabled:opacity-50",
          danger ? "bg-king-red hover:bg-king-bright-red" : "bg-white/15 hover:bg-white/25"
        )}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-king-gray transition-colors hover:bg-white/[0.06] hover:text-king-white"
      >
        Cancel
      </button>
    </span>
  )
}

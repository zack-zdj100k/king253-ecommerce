"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"

type Result = { ok: true; message?: string } | { ok: false; error: string }

/**
 * Two-step delete: the first click asks, the second deletes. Errors from the
 * server (e.g. "units are reserved for open orders") are shown inline.
 */
export function DeleteButton({
  action,
  label = "Delete",
  confirm = "Delete permanently?",
  redirectTo,
  compact = false,
  className,
}: {
  action: () => Promise<Result>
  label?: string
  /** Short question shown before the final click. */
  confirm?: string
  /** Where to go after a successful delete (detail pages). */
  redirectTo?: string
  /** Icon-only trigger for table rows. */
  compact?: boolean
  className?: string
}) {
  const router = useRouter()
  const { run, pending, feedback, setFeedback } = useAdminAction()
  const [asking, setAsking] = React.useState(false)

  React.useEffect(() => {
    if (!asking) return
    const t = window.setTimeout(() => setAsking(false), 6000)
    return () => window.clearTimeout(t)
  }, [asking])

  const base = "inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      {!asking ? (
        <button
          type="button"
          onClick={() => {
            setFeedback(null)
            setAsking(true)
          }}
          aria-label={compact ? label : undefined}
          title={compact ? label : undefined}
          className={cn(
            base,
            compact
              ? "size-8 rounded-full text-king-gray hover:bg-king-red/15 hover:text-king-bright-red"
              : "h-10 rounded-full border border-king-bright-red/30 px-4 text-sm text-king-bright-red hover:bg-king-red hover:text-king-white"
          )}
        >
          <Trash2 className="size-3.5" aria-hidden />
          {compact ? null : label}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-king-bright-red/25 bg-king-red/10 py-1 pr-1 pl-3" role="group" aria-label={confirm}>
          <span className="text-xs whitespace-nowrap text-king-white">{confirm}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(action, () => {
                setAsking(false)
                if (redirectTo) router.push(redirectTo)
              })
            }
            className={cn(base, "h-8 rounded-full bg-king-red px-3.5 text-king-white hover:bg-king-bright-red")}
          >
            {pending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Trash2 className="size-3" aria-hidden />}
            Yes, delete
          </button>
          <button type="button" disabled={pending} onClick={() => setAsking(false)} className={cn(base, "h-8 rounded-full px-3 text-king-gray hover:bg-white/[0.06] hover:text-king-white")}>
            Cancel
          </button>
        </span>
      )}
      {feedback?.tone === "error" ? <Feedback feedback={feedback} /> : null}
    </span>
  )
}

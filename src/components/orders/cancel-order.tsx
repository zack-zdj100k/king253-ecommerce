"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"

import { cancelOrderAction } from "@/app/actions/orders"
import type { CustomerOrderView } from "@/server/orders/view"
import { Button } from "@/components/ui/button"

const REASONS = ["I changed my mind", "I ordered the wrong size or colour", "I found it cheaper elsewhere", "Delivery takes too long", "Other"]

/**
 * Lets the customer cancel while the order is not yet being prepared.
 * Proof of ownership is the order's secret link (`token`) or the order phone.
 */
export function CancelOrder({
  order,
  token,
  phone,
  onCancelled,
}: {
  order: CustomerOrderView
  token?: string
  phone?: string
  /** Track page: receives the refreshed order. Otherwise the page is refreshed. */
  onCancelled?: (order: CustomerOrderView) => void
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState(REASONS[0])
  const [error, setError] = React.useState<string | null>(null)
  const [pending, start] = React.useTransition()

  if (order.status === "cancelled") {
    return (
      <p className="flex items-center gap-2 border border-white/10 p-4 text-sm text-king-muted" role="status">
        <XCircle className="size-4 text-king-gray" aria-hidden /> This order was cancelled.
      </p>
    )
  }
  if (!order.cancellable) {
    return <p className="text-sm text-king-gray">Your order is already being prepared or on its way. To cancel it now, please call us.</p>
  }
  if (!open) {
    return (
      <Button type="button" variant="kingOutline" size="xl" onClick={() => setOpen(true)}>
        <XCircle className="size-4" aria-hidden /> Cancel this order
      </Button>
    )
  }
  return (
    <div className="max-w-xl space-y-4 border border-king-red-line bg-king-red/10 p-5">
      <p className="text-sm font-medium text-king-white">Cancel order {order.number}?</p>
      <label className="block">
        <span className="mb-2 block text-sm text-king-muted">Why are you cancelling? (optional)</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="h-12 w-full rounded-[6px] border border-white/12 bg-black/40 px-4 text-sm text-king-white focus-visible:border-king-bright-red focus-visible:outline-none"
        >
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-sm text-king-bright-red">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="king"
          size="xl"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const r = await cancelOrderAction({ number: order.number, token, phone, reason })
              if (!r.ok) return setError(r.error)
              setOpen(false)
              if (onCancelled) onCancelled(r.order)
              else router.refresh()
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Yes, cancel it
        </Button>
        <Button type="button" variant="kingOutline" size="xl" onClick={() => setOpen(false)}>
          Keep my order
        </Button>
      </div>
    </div>
  )
}

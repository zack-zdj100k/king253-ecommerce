import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { CustomerOrderView } from "@/server/orders/view"

const fmt = (d: Date | string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

/** Simplified customer timeline. */
export function OrderTimeline({ order }: { order: CustomerOrderView }) {
  if (order.status === "cancelled") {
    return (
      <p className="flex items-center gap-3 border border-white/10 p-4 text-sm text-king-muted">
        <X className="size-4 text-king-bright-red" aria-hidden /> This order was cancelled{order.cancelledAt ? ` on ${fmt(order.cancelledAt)}` : ""}.
      </p>
    )
  }
  const reachedIndex = order.timeline.reduce((last, step, i) => (step.at ? i : last), 0)
  return (
    <ol className="grid gap-4 sm:grid-cols-5">
      {order.timeline.map((step, i) => {
        const done = i <= reachedIndex
        return (
          <li key={step.key} className="flex items-start gap-3 sm:flex-col">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border", done ? "border-king-bright-red bg-king-red text-king-white" : "border-white/15 text-king-gray")}>
              {done ? <Check className="size-4" aria-hidden /> : <span className="text-xs">{i + 1}</span>}
            </span>
            <span>
              <span className={cn("king-label block text-[0.6rem]", done ? "text-king-white" : "text-king-gray")}>{step.label}</span>
              {step.at && <span className="mt-1 block text-xs text-king-gray">{fmt(step.at)}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

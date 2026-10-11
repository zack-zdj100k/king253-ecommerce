import type { CustomerOrderView } from "@/server/orders/view"

const RETURN_STATUS: Record<string, string> = {
  requested: "Request received",
  approved: "Approved — we'll contact you",
  received: "Item received",
  completed: "Completed",
}

/** Returns and exchanges on an order, as the customer sees them. */
export function OrderReturns({ order }: { order: CustomerOrderView }) {
  if (!order.returns.length) return null
  return (
    <div className="border-t border-white/10 pt-10">
      <h2 className="king-label text-[0.6rem] text-king-gray">Returns & exchanges</h2>
      <ul className="mt-4 space-y-2 text-sm text-king-muted">
        {order.returns.map((r) => {
          const item = order.items.find((i) => i.id === r.itemId)
          return (
            <li key={r.id}>
              {r.type === "exchange" ? "Exchange" : "Return"} · {item?.name} ({item?.size}) × {r.quantity} — <span className="text-king-white">{RETURN_STATUS[r.status] ?? r.status}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

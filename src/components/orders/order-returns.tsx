import { formatDA } from "@/lib/money"
import type { CustomerOrderView } from "@/server/orders/view"

/** Returns and exchanges the shop recorded on this order, as the customer sees them. */
export function OrderReturns({ order }: { order: CustomerOrderView }) {
  if (!order.returns.length) return null
  return (
    <div className="border-t border-white/10 pt-10">
      <h2 className="king-label text-[0.6rem] text-king-gray">Returns & exchanges</h2>
      <ul className="mt-4 space-y-4 text-sm text-king-muted">
        {order.returns.map((r) => (
          <li key={r.id} className="border border-white/10 p-4">
            <p className="font-semibold text-king-white">
              {r.type === "exchange" ? "Exchange" : "Return"} · {new Date(r.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <ul className="mt-2 space-y-1">
              {r.items.map((i, n) => (
                <li key={n}>
                  {i.direction === "in" ? "Returned" : "Received"}: {i.name} ({i.color} / {i.size}) × {i.quantity}
                </li>
              ))}
            </ul>
            {r.amount !== 0 && (
              <p className="mt-2 text-king-white">
                {r.amount < 0 ? `Refunded to you: ${formatDA(-r.amount)}` : `Paid by you: ${formatDA(r.amount)}`}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

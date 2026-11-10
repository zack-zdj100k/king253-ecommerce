import { useLocale, useTranslations } from "next-intl"
import { formatDA } from "@/lib/money"
import type { CustomerOrderView } from "@/server/orders/view"

/** Returns and exchanges the shop recorded on this order, as the customer sees them. */
export function OrderReturns({ order }: { order: CustomerOrderView }) {
  const t = useTranslations("order")
  const locale = useLocale()
  if (!order.returns.length) return null
  return (
    <div className="border-t border-white/10 pt-10">
      <h2 className="king-label text-[0.625rem] text-king-gray">{t("returns")}</h2>
      <ul className="mt-4 space-y-4 text-sm text-king-muted">
        {order.returns.map((r) => (
          <li key={r.id} className="border border-white/10 p-4">
            <p className="font-semibold text-king-white">
              {r.type === "exchange" ? t("exchange") : t("return")} · {new Date(r.at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <ul className="mt-2 space-y-1">
              {r.items.map((i, n) => (
                <li key={n}>
                  {i.direction === "in" ? t("returnedItem") : t("receivedItem")}: {i.name} ({i.color} / {i.size}) × {i.quantity}
                </li>
              ))}
            </ul>
            {r.amount !== 0 && (
              <p className="mt-2 text-king-white">
                {r.amount < 0 ? t("refunded", { amount: formatDA(-r.amount) }) : t("paidByYou", { amount: formatDA(r.amount) })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useTranslations } from "next-intl"
import { formatDA } from "@/lib/money"
import type { CustomerOrderView } from "@/server/orders/view"
import { ProductImage } from "@/components/shop/product-image"

export function OrderSummary({ order }: { order: CustomerOrderView }) {
  const t = useTranslations("order")
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h2 className="king-label text-[0.6rem] text-king-gray">{t("items")}</h2>
        <ul className="mt-3 divide-y divide-white/5">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-4 py-3">
              <span className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-king-card">
                {i.imageUrl ? <ProductImage image={{ url: i.imageUrl, focusX: 50, focusY: 40, zoom: 1 }} alt="" sizes="120px" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-king-white uppercase">{i.name}</span>
                <span className="king-label mt-1 block text-[0.55rem] text-king-gray">
                  {i.color} / {i.size} × {i.quantity}
                </span>
              </span>
              <span className="text-sm text-king-muted">{formatDA(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-6">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between text-king-gray">
            <dt>{t("clothes")}</dt>
            <dd className="text-king-white">{formatDA(order.money.subtotal)}</dd>
          </div>
          {order.money.discount > 0 && (
            <div className="flex justify-between text-king-gray">
              <dt>{t("discount")}</dt>
              <dd className="text-king-white">− {formatDA(order.money.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-king-gray">
            <dt>{t("delivery")}</dt>
            <dd className="text-right text-king-white">
              {order.money.shipsWith
                ? t("sharedWith", { number: order.money.shipsWith })
                : order.money.freeDelivery
                  ? t("free")
                  : order.money.deliveryFee > 0 || !["pending", "contacting"].includes(order.status)
                    ? formatDA(order.money.deliveryFee)
                    : t("byPhone")}
            </dd>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-king-white">
            <dt>{t("toPay")}</dt>
            <dd>{formatDA(order.money.total)}</dd>
          </div>
          {order.money.shipsWith && (
            <p className="text-xs leading-relaxed text-king-gray">
              {t("sharedNote", { number: order.money.shipsWith })}
            </p>
          )}
        </dl>
        <div className="text-sm leading-relaxed text-king-muted">
          <h2 className="king-label mb-2 text-[0.6rem] text-king-gray">{t("delivery")}</h2>
          <p>{order.customerName}</p>
          <p className="text-king-white">{order.delivery.type === "desk" ? t("stopDesk", { name: order.delivery.deskName ?? "—" }) : t("homeDelivery")}</p>
          {order.delivery.type === "desk" && order.delivery.deskAddress ? <p>{order.delivery.deskAddress}</p> : null}
          <p>
            {order.delivery.address}, {order.delivery.city}, {order.delivery.wilaya}
          </p>
          {order.delivery.estimatedDays ? <p className="text-king-gray">{t("estimated", { time: order.delivery.estimatedDays })}</p> : null}
        </div>
      </div>
    </div>
  )
}

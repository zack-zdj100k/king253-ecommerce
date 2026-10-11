import { formatDA } from "@/lib/money"
import type { CustomerOrderView } from "@/server/orders/view"
import { ProductImage } from "@/components/shop/product-image"

export function OrderSummary({ order }: { order: CustomerOrderView }) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h2 className="king-label text-[0.6rem] text-king-gray">Items</h2>
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
            <dt>Clothes</dt>
            <dd className="text-king-white">{formatDA(order.money.subtotal)}</dd>
          </div>
          {order.money.discount > 0 && (
            <div className="flex justify-between text-king-gray">
              <dt>Discount</dt>
              <dd className="text-king-white">− {formatDA(order.money.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-king-gray">
            <dt>Delivery</dt>
            <dd className="text-right text-king-white">
              {order.money.shipsWith
                ? `Shared with ${order.money.shipsWith}`
                : order.money.freeDelivery
                  ? "Free"
                  : order.money.deliveryFee > 0 || !["pending", "contacting"].includes(order.status)
                    ? formatDA(order.money.deliveryFee)
                    : "Confirmed by phone"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-king-white">
            <dt>To pay on delivery</dt>
            <dd>{formatDA(order.money.total)}</dd>
          </div>
          {order.money.shipsWith && (
            <p className="text-xs leading-relaxed text-king-gray">
              You ordered again before {order.money.shipsWith} was delivered — both come in one delivery, so you pay the delivery only once.
            </p>
          )}
        </dl>
        <div className="text-sm leading-relaxed text-king-muted">
          <h2 className="king-label mb-2 text-[0.6rem] text-king-gray">Delivery</h2>
          <p>{order.customerName}</p>
          <p>
            {order.delivery.address}, {order.delivery.city}, {order.delivery.wilaya}
          </p>
          {order.delivery.estimatedDays ? <p className="text-king-gray">Estimated: {order.delivery.estimatedDays}</p> : null}
        </div>
      </div>
    </div>
  )
}

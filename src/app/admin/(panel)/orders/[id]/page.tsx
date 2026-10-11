import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Mail, MessageCircle, Phone } from "lucide-react"

import { formatDA } from "@/lib/money"
import { formatPhone, whatsappLink } from "@/lib/phone"
import { db } from "@/server/db"
import { getOrderDetail } from "@/server/admin/queries"
import { STATUS_LABELS } from "@/server/orders/manage"
import { orderMoney } from "@/server/pricing"
import { deleteOrderAction } from "@/app/admin/actions/orders"
import { DeleteButton } from "@/components/admin/delete-button"
import { ReturnActions } from "@/components/admin/moderation"
import { AdminReturnForm } from "@/components/admin/order/return-form"
import { DeliveryPanel, DiscountPanel, ItemsPanel, NotesPanel, StatusPanel } from "@/components/admin/order/order-panels"
import { Badge, PageHeader, Panel, btnRed, btnOutline } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Order" }

const fmt = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

const AUDIT_LABELS: Record<string, string> = {
  "order.status": "Status changed",
  "order.item.update": "Item changed",
  "order.item.add": "Item added",
  "order.item.remove": "Item removed",
  "order.delivery.update": "Delivery changed",
  "order.discount": "Discount changed",
  "order.notes": "Notes edited",
  "order.delete": "Order deleted",
}

/* Audit entries in plain words: only the fields that changed, never raw data. */
const FIELD_LABELS: Record<string, string> = {
  wilaya: "Wilaya",
  city: "Commune",
  address: "Address",
  fee: "Delivery fee",
  free: "Free delivery",
  type: "Discount type",
  value: "Discount",
  amount: "Discount amount",
  sku: "SKU",
  size: "Size",
  color: "Colour",
  quantity: "Quantity",
  status: "Status",
  price: "Price",
  salePrice: "Promo price",
  name: "Name",
}
const MONEY_FIELDS = new Set(["fee", "amount", "price", "salePrice"])

function showValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (key === "type") return v === "fixed" ? "Fixed (DA)" : v === "percent" ? "Percent" : String(v)
  if (MONEY_FIELDS.has(key) && typeof v === "number") return formatDA(v)
  return typeof v === "object" ? "—" : String(v)
}

function describeChanges(before: unknown, after: unknown): string[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => k in FIELD_LABELS)
  if (!before || !after) {
    // Added or removed: list what it was.
    const side = before ? b : a
    const parts = keys.filter((k) => k in side).map((k) => `${FIELD_LABELS[k]} ${showValue(k, side[k])}`)
    return parts.length ? [parts.join(" · ")] : []
  }
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k])).map((k) => `${FIELD_LABELS[k]}: ${showValue(k, b[k])} → ${showValue(k, a[k])}`)
}

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const detail = await getOrderDetail(db, id)
  if (!detail) notFound()
  const { order, items, history, audit, mails, returns, customerOrders, shipping } = detail
  const money = orderMoney(order)
  const refunded = returns.reduce((n, r) => n + (r.type === "return" && r.status === "completed" ? (r.refundAmount ?? 0) : 0), 0)
  const editable = order.status !== "delivered" && order.status !== "cancelled"

  const firstName = order.customerName.split(" ")[0]
  const waMessage = `Bonjour ${firstName}, ici KING 253 concernant votre commande ${order.number} (${STATUS_LABELS[order.status]}) — total ${formatDA(order.total)}, livraison ${order.wilayaName}, ${order.city}.`

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Order · ${fmt(order.createdAt)}`}
        title={order.number}
        actions={
          <DeleteButton
            label="Delete order"
            confirm={editable ? "Delete and release its reserved stock?" : "Delete this order permanently?"}
            action={deleteOrderAction.bind(null, order.id)}
            redirectTo="/admin/orders"
          />
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge status={order.status}>{STATUS_LABELS[order.status]}</Badge>
          <span className="text-xs font-medium text-king-gray">Cash on delivery</span>
          <Link href="/admin/orders" className="text-xs font-medium text-king-gray hover:text-king-white">← All orders</Link>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Status">
            <StatusPanel orderId={order.id} status={order.status} />
          </Panel>

          <Panel title="Items">
            <ItemsPanel
              orderId={order.id}
              editable={editable}
              items={items.map((r) => ({ ...r.item, variants: r.variants }))}
            />
            <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-sm">
              <div className="flex justify-between text-king-gray"><dt>Clothes</dt><dd className="text-king-white">{formatDA(order.subtotal)}</dd></div>
              <div className="flex justify-between text-king-gray">
                <dt>Discount{order.discountType === "percent" ? ` (${order.discountValue}%)` : ""}</dt>
                <dd className="text-king-white">{order.discountAmount ? `− ${formatDA(order.discountAmount)}` : "—"}</dd>
              </div>
              <div className="flex justify-between font-medium text-king-white"><dt>Clothes total</dt><dd>{formatDA(money.clothes)}</dd></div>
              <div className="flex justify-between gap-4 text-king-gray">
                <dt>Delivery</dt>
                <dd className="text-right text-king-white">
                  {shipping.lead ? (
                    <>Included in {shipping.lead.number}</>
                  ) : order.freeDelivery ? (
                    <>Free for the customer <span className="text-king-gray">· shop pays {order.deliveryFee > 0 ? formatDA(order.deliveryFee) : "the courier"}</span></>
                  ) : order.deliveryFee > 0 ? (
                    <>{formatDA(order.deliveryFee)} <span className="text-king-gray">· paid by the customer</span></>
                  ) : (
                    "To confirm by phone"
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold text-king-white">
                <dt>To collect at delivery</dt>
                <dd>{formatDA(order.total)}</dd>
              </div>
              {refunded > 0 && (
                <div className="flex justify-between text-king-gray">
                  <dt>Refunded (returned items)</dt>
                  <dd className="text-king-bright-red">− {formatDA(refunded)}</dd>
                </div>
              )}
              <div className="flex justify-between rounded-xl bg-emerald-400/[0.06] px-3 py-2 text-emerald-200">
                <dt>
                  Shop keeps (clothes{order.freeDelivery ? " − delivery" : ""}
                  {refunded > 0 ? " − refunds" : ""})
                </dt>
                <dd className="font-semibold">{formatDA(money.shopKeeps - refunded)}</dd>
              </div>
            </dl>
            <div className="mt-5">
              <DiscountPanel orderId={order.id} editable={editable} current={{ type: order.discountType, value: order.discountValue }} subtotal={order.subtotal} />
            </div>
          </Panel>

          {(order.status === "delivered" || returns.length > 0) && (
            <div id="returns" className="scroll-mt-24">
            <Panel
              title="Returns & exchanges"
              actions={
                <Link href="/admin/returns" className="text-xs font-medium text-king-gray hover:text-king-white">
                  All returns
                </Link>
              }
            >
              {returns.length > 0 && (
                <ul className="mb-5 space-y-4">
                  {returns.map((r) => {
                    const line = items.find((i) => i.item.id === r.orderItemId)
                    const swap = r.replacementVariantId ? line?.variants.find((x) => x.id === r.replacementVariantId) : null
                    return (
                      <li key={r.id} className="space-y-2 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-king-white capitalize">
                            {r.type} × {r.quantity}
                          </span>
                          <Badge status={r.status}>{r.status}</Badge>
                        </div>
                        <p className="text-king-muted">
                          {line ? `${line.item.productName} — ${line.item.color} / ${line.item.size}` : "Item"}
                          {swap ? ` → ${swap.color} / ${swap.size}` : ""}
                        </p>
                        <p className="text-xs text-king-gray">
                          {r.reason}
                          {r.details ? ` — ${r.details}` : ""}
                        </p>
                        {r.refundAmount ? <p className="text-xs text-king-bright-red">Refunded {formatDA(r.refundAmount)}</p> : null}
                        <ReturnActions id={r.id} status={r.status} type={r.type} />
                      </li>
                    )
                  })}
                </ul>
              )}
              {order.status === "delivered" ? (
                <AdminReturnForm
                  orderId={order.id}
                  items={items
                    .filter((r) => !r.item.removedAt)
                    .map((r) => ({
                      id: r.item.id,
                      name: r.item.productName,
                      size: r.item.size,
                      color: r.item.color,
                      variantId: r.item.variantId,
                      returnable:
                        r.item.quantity -
                        returns.filter((x) => x.orderItemId === r.item.id && x.status !== "rejected").reduce((n, x) => n + x.quantity, 0),
                      options: r.variants,
                    }))}
                />
              ) : null}
            </Panel>
            </div>
          )}

          <Panel title="Delivery">
            <div className="mb-4 text-sm leading-relaxed text-king-muted">
              <p className="text-king-white">Home delivery</p>
              {shipping.lead && (
                <p className="my-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm">
                  One parcel with{" "}
                  <Link href={`/admin/orders/${shipping.lead.id}`} className="font-medium text-king-white underline-offset-4 hover:underline">
                    {shipping.lead.number}
                  </Link>{" "}
                  ({STATUS_LABELS[shipping.lead.status]}) — the customer ordered again before it was delivered, so the delivery is charged once, on that order.
                </p>
              )}
              {shipping.followers.length > 0 && (
                <p className="my-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm">
                  Deliver together with{" "}
                  {shipping.followers.map((f, i) => (
                    <span key={f.id}>
                      {i > 0 ? ", " : ""}
                      <Link href={`/admin/orders/${f.id}`} className="font-medium text-king-white underline-offset-4 hover:underline">
                        {f.number}
                      </Link>{" "}
                      ({STATUS_LABELS[f.status]})
                    </span>
                  ))}{" "}
                  — same customer, one parcel, this order carries the delivery fee.
                </p>
              )}
              <p>{order.address}, {order.city}, {order.wilayaName}</p>
              {order.estimatedDays && <p className="text-king-gray">Estimated: {order.estimatedDays}</p>}
              {order.customerNotes && <p className="mt-2 border-l-2 border-king-red-line pl-3">Customer note: {order.customerNotes}</p>}
            </div>
            <DeliveryPanel
              orderId={order.id}
              editable={editable}
              current={{ wilaya: order.wilayaName, city: order.city, address: order.address, deliveryFee: order.deliveryFee, freeDelivery: order.freeDelivery }}
            />
          </Panel>

          <Panel title="Emails">
            {mails.length ? (
              <ul className="space-y-2 text-xs text-king-muted">
                {mails.map((m) => (
                  <li key={m.id}>
                    <span className="text-king-white">{m.subject}</span> → {m.recipient} · <Badge status={m.status === "sent" ? "completed" : "draft"}>{m.status}</Badge>
                    {m.error && <span className="block text-king-gray">{/smtp/i.test(m.error) ? "Not sent: the email service is not set up yet." : "Not sent: the email could not be delivered."}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-king-gray">No emails for this order (no customer email, or no admin email configured).</p>
            )}
          </Panel>

          <Panel title="Audit log">
            {audit.length ? (
              <ul className="space-y-2 text-xs text-king-muted">
                {audit.map((a) => {
                  const data = (a.data ?? {}) as Record<string, unknown>
                  return (
                    <li key={a.id}>
                      <span className="text-king-white">{AUDIT_LABELS[a.action] ?? a.action}</span> · {String(data.actor ?? "")} · {fmt(a.createdAt)}
                      {describeChanges(data.before, data.after).map((line) => (
                        <span key={line} className="block text-king-gray">
                          {line}
                        </span>
                      ))}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-xs text-king-gray">No changes yet.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="text-lg font-semibold text-king-white">{order.customerName}</p>
            <p className="mt-1 text-sm text-king-muted">
              {formatPhone(order.customerPhone)}
              {order.customerAge ? ` · ${order.customerAge} y/o` : ""}
            </p>
            {order.customerEmail && <p className="text-sm text-king-muted">{order.customerEmail}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:${order.customerPhone}`} className={btnRed}>
                <Phone className="size-3.5" aria-hidden /> Call
              </a>
              <a href={whatsappLink(order.customerPhone, waMessage)} target="_blank" rel="noreferrer" className={btnOutline}>
                <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
              </a>
              {order.customerEmail && (
                <a href={`mailto:${order.customerEmail}?subject=${encodeURIComponent(`KING 253 — ${order.number}`)}`} className={btnOutline}>
                  <Mail className="size-3.5" aria-hidden /> Email
                </a>
              )}
            </div>
            <p className="mt-3 text-xs text-king-gray">WhatsApp opens with a prepared message — nothing is sent until you press send.</p>
            {order.customerId ? (
              <Link href={`/admin/customers/${order.customerId}`} className="mt-4 inline-block text-xs font-medium text-king-muted hover:text-king-white">
                Customer profile · {customerOrders} order(s) {customerOrders > 1 ? "— returning customer" : ""}
              </Link>
            ) : (
              <p className="mt-4 text-xs font-medium text-king-gray">Customer profile deleted</p>
            )}
          </Panel>

          <Panel title="Timeline">
            <ol className="space-y-3 border-l border-white/10 pl-4">
              {history.map((h) => (
                <li key={h.id} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-king-bright-red" aria-hidden />
                  <p className="text-king-white">{STATUS_LABELS[h.toStatus]}</p>
                  <p className="text-xs text-king-gray">{fmt(h.createdAt)} · {h.actorLabel}</p>
                  {h.note && <p className="mt-1 text-xs text-king-muted">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Admin notes">
            <NotesPanel orderId={order.id} notes={order.adminNotes ?? ""} />
          </Panel>

        </div>
      </div>
    </div>
  )
}

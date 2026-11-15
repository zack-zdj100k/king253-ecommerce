import type { Metadata } from "next"
import { and, asc, eq, isNull } from "drizzle-orm"
import { notFound } from "next/navigation"

import { formatPhone } from "@/lib/phone"
import { db } from "@/server/db"
import { requireAdminPage } from "@/server/auth/session"
import { orderItems, orders, products, stores } from "@/server/db/schema"
import { getSettings } from "@/server/settings"
import { PrintButton } from "./print-button"

export const metadata: Metadata = { title: "Ticket", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/*
 * Order ticket for the shop's thermal receipt printer (Xprinter XP-D200N, 80 mm paper, ESC/POS).
 * Printable width is 72 mm; everything is black on white (thermal paper has no grey), big enough to
 * read at a glance, one column, no tables wider than the paper. Bilingual French / Arabic.
 */

const da = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} DA`
const plain = (s: string) => s.replace(/[⁦-⁩]/g, "")
const date = (d: Date) =>
  d.toLocaleString("fr-FR", { timeZone: "Africa/Algiers", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

/** Label / value on one block: small label (FR · AR), the value below it, bold. */
function Field({ fr, ar, children }: { fr: string; ar: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <p className="lbl">
        {fr} · <bdi dir="rtl">{ar}</bdi>
      </p>
      <p className="val">
        <bdi>{children}</bdi>
      </p>
    </div>
  )
}

export default async function PrintOrder({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [order] = await db.select().from(orders).where(eq(orders.id, id))
  if (!order) notFound()
  const [shop] = order.storeId ? await db.select().from(stores).where(eq(stores.id, order.storeId)) : []
  const settings = await getSettings(db)
  const items = await db
    .select({ item: orderItems, material: products.material })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orderItems.orderId, order.id), isNull(orderItems.removedAt)))
    .orderBy(asc(orderItems.createdAt))

  const shopName = shop?.name ?? settings.brandName
  const shopPhone = shop?.phone || settings.contactPhone || ""
  const units = items.reduce((n, r) => n + r.item.quantity, 0)
  const customerPays = order.freeDelivery || order.shipsWithOrderId ? 0 : order.deliveryFee
  const deliveryWord = order.deliveryType === "desk" ? "Stop desk" : "Domicile"
  const feeLabel = order.shipsWithOrderId ? "Groupée" : order.freeDelivery ? "Offerte" : order.deliveryFee > 0 ? da(order.deliveryFee) : "Par téléphone"
  const toCollect = order.subtotal - order.discountAmount + customerPays

  return (
    <div data-no-translate className="ticket-page min-h-svh bg-neutral-300 py-4 text-black print:bg-white print:py-0">
      <style>{`
        /* 80 mm roll: the page is as long as the ticket. The printer's printable width is 72 mm. */
        @page { size: 80mm auto; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          .ticket-page { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .ticket { box-shadow: none !important; margin: 0 !important; }
        }
        .ticket { width: 72mm; margin: 0 auto; padding: 3mm 1.5mm 6mm; background: #fff; box-sizing: border-box; color: #000; font-family: Arial, Helvetica, Tahoma, sans-serif; font-size: 11.5px; line-height: 1.35; box-shadow: 0 2px 10px rgba(0,0,0,.25); }
        .ticket * { color: #000 !important; }
        .ticket p { margin: 0; }
        .sep { border: 0; border-top: 1.5px dashed #000; margin: 7px 0; }
        .sep-solid { border-top-style: solid; }
        .center { text-align: center; }
        .h1 { font-size: 15px; font-weight: 900; letter-spacing: .02em; }
        .field { margin: 5px 0; }
        .lbl { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
        .val { font-size: 12.5px; font-weight: 800; word-break: break-word; }
        .big { font-size: 16px; font-weight: 900; }
        .row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
        .item { margin: 6px 0; padding-bottom: 6px; border-bottom: 1px dotted #000; }
        .item:last-child { border-bottom: 0; }
        .name { font-size: 12.5px; font-weight: 800; }
        .meta { font-size: 11px; }
        .total { font-size: 17px; font-weight: 900; }
      `}</style>

      <div className="no-print mx-auto mb-3 flex max-w-[72mm] items-center justify-between gap-2 px-1">
        <a href={`/admin/orders/${order.id}`} className="text-xs underline">← Retour</a>
        <PrintButton />
      </div>

      <article dir="ltr" className="ticket">
        {/* Brand + shop */}
        <header className="center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/king253-logo-receipt.png" alt="KING 253" style={{ width: "46mm", height: "auto", margin: "0 auto", display: "block" }} />
          <p className="h1" style={{ marginTop: 4 }}>{shopName}</p>
          {shop && <p className="meta">{[shop.address, shop.city].filter(Boolean).join(", ")}</p>}
          {shopPhone && (
            <p className="val">
              ☎ <bdi>{plain(formatPhone(shopPhone))}</bdi>
            </p>
          )}
        </header>

        <hr className="sep" />

        <div className="center">
          <p className="lbl">Commande · <bdi dir="rtl">الطلب</bdi></p>
          <p className="big" style={{ letterSpacing: ".01em" }}>{order.number}</p>
          <p className="meta">{date(order.createdAt)}</p>
        </div>

        <hr className="sep" />

        {/* Client */}
        <Field fr="Client" ar="الزبون">{order.customerName}</Field>
        <Field fr="Téléphone" ar="الهاتف">
          <span className="big">{plain(formatPhone(order.customerPhone))}</span>
        </Field>
        {order.customerEmail && <Field fr="Email" ar="البريد">{order.customerEmail}</Field>}

        <hr className="sep" />

        {/* Destination (the delivery's final point) */}
        <Field fr="Livraison" ar="التوصيل">
          {deliveryWord}
        </Field>
        <Field fr="Destination" ar="الوجهة">
          {order.wilayaCode ? `${String(order.wilayaCode).padStart(2, "0")} — ` : ""}
          {order.wilayaName}, {order.city}
        </Field>
        <Field fr="Adresse" ar="العنوان">
          {order.address}
        </Field>
        {order.deliveryType === "desk" && (order.deskName || order.deskAddress) && (
          <Field fr="Bureau" ar="المكتب">
            {[order.deskName, order.deskAddress].filter(Boolean).join(" — ")}
          </Field>
        )}
        {order.customerNotes && (
          <Field fr="Note" ar="ملاحظة">
            {order.customerNotes}
          </Field>
        )}

        <hr className="sep sep-solid" />

        {/* Items */}
        <p className="lbl">Articles ({units}) · <bdi dir="rtl">المنتجات</bdi></p>
        {items.map(({ item, material }) => (
          <div key={item.id} className="item">
            <p className="name">{item.productName}</p>
            <p className="meta">
              {item.color} · Taille <b>{item.size}</b>
              {material ? ` · ${material}` : ""}
            </p>
            <div className="row meta">
              <span>
                {item.quantity} × {da(item.unitPrice)}
              </span>
              <b>{da(item.lineTotal)}</b>
            </div>
          </div>
        ))}

        <hr className="sep sep-solid" />

        {/* Cost */}
        <div className="row">
          <span>Articles</span>
          <b>{da(order.subtotal)}</b>
        </div>
        {order.discountAmount > 0 && (
          <div className="row">
            <span>Remise</span>
            <b>− {da(order.discountAmount)}</b>
          </div>
        )}
        <div className="row">
          <span>Livraison {order.deliveryType === "desk" ? "stop desk" : "domicile"}</span>
          <b>{feeLabel}</b>
        </div>
        <hr className="sep" />
        <div className="row total">
          <span>À ENCAISSER</span>
          <span>{da(toCollect)}</span>
        </div>
        <p className="meta center" style={{ marginTop: 3 }}>
          Paiement à la livraison · <bdi dir="rtl">الدفع عند الاستلام</bdi>
        </p>

        <hr className="sep" />
        <p className="center meta">KING 253 vous remercie · <bdi dir="rtl">شكراً لكم</bdi></p>
      </article>
    </div>
  )
}

import type { Metadata } from "next"
import { and, asc, eq, isNull } from "drizzle-orm"
import { notFound } from "next/navigation"

import { formatPhone } from "@/lib/phone"
import { db } from "@/server/db"
import { requireAdminPage } from "@/server/auth/session"
import { orderItems, orders, products, stores } from "@/server/db/schema"
import { getSettings } from "@/server/settings"
import { PrintButton } from "./print-button"

export const metadata: Metadata = { title: "Bon de commande", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/* Printed slip for a confirmed order: what goes in the parcel, where it goes, what to collect.
   Bilingual French / Arabic (the courier and the shop both read it). Plain black on white. */

const da = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} DA`
const plain = (s: string) => s.replace(/[⁦-⁩]/g, "")
const date = (d: Date) =>
  d.toLocaleString("fr-FR", { timeZone: "Africa/Algiers", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

/** "French · عربي : value" — each part isolated so French, Arabic and numbers never swap places. */
function Line({ fr, ar, children, strong = true }: { fr: string; ar: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5">
      <span>{fr}</span>
      <span>·</span>
      <bdi dir="rtl">{ar}</bdi>
      <span>:</span>
      <bdi className={strong ? "font-bold" : ""}>{children}</bdi>
    </p>
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
  const deliveryLabel = order.deliveryType === "desk" ? "Stop desk (bureau)" : "À domicile"

  return (
    <div data-no-translate className="print-slip min-h-svh bg-neutral-200 py-6 text-black print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print { .no-print { display: none !important; } .print-slip { min-height: 0 !important; } }
        .print-slip table { border-collapse: collapse; width: 100%; }
        .print-slip th, .print-slip td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
      `}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <a href={`/admin/orders/${order.id}`} className="text-sm underline">← Retour à la commande</a>
        <PrintButton />
      </div>

      <article dir="ltr" className="mx-auto max-w-[210mm] bg-white p-[12mm] font-sans text-[12.5px] leading-snug shadow print:max-w-none print:p-0 print:shadow-none">
        {/* Shop */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
          <div>
            <p className="text-[26px] font-black tracking-tight">KING 253</p>
            <p className="text-[14px] font-bold">{shopName}</p>
            {shop && <p>{[shop.address, shop.city, shop.wilaya].filter(Boolean).join(", ")}</p>}
            {shopPhone && <Line fr="Tél." ar="الهاتف">{plain(formatPhone(shopPhone))}</Line>}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase">Bon de commande · <bdi dir="rtl">وصل الطلب</bdi></p>
            <p className="text-[18px] font-black">{order.number}</p>
            <div className="flex flex-col items-end">
              <Line fr="Date" ar="التاريخ">{date(order.createdAt)}</Line>
              <Line fr="Imprimé le" ar="طُبع في" strong={false}>{date(new Date())}</Line>
            </div>
          </div>
        </header>

        {/* Customer + destination */}
        <section className="mt-4 grid grid-cols-2 gap-4">
          <div className="border border-black p-3">
            <p className="mb-1 text-[11px] font-bold uppercase">Client · <bdi dir="rtl">الزبون</bdi></p>
            <p className="text-[16px] font-bold">{order.customerName}</p>
            <p className="text-[18px] font-black tracking-wide">{plain(formatPhone(order.customerPhone))}</p>
          </div>
          <div className="border border-black p-3">
            <p className="mb-1 text-[11px] font-bold uppercase">Destination · <bdi dir="rtl">الوجهة</bdi></p>
            <Line fr="Wilaya" ar="الولاية">{order.wilayaCode ? `${String(order.wilayaCode).padStart(2, "0")} — ` : ""}{order.wilayaName}</Line>
            <Line fr="Commune" ar="البلدية">{order.city}</Line>
            <Line fr="Adresse" ar="العنوان">{order.address}</Line>
            <Line fr="Livraison" ar="التوصيل">{deliveryLabel}</Line>
            {order.deliveryType === "desk" && (order.deskName || order.deskAddress) && (
              <Line fr="Bureau" ar="المكتب">{[order.deskName, order.deskAddress].filter(Boolean).join(" — ")}</Line>
            )}
          </div>
        </section>

        {order.customerNotes && (
          <div className="mt-3 border border-black p-2"><Line fr="Note du client" ar="ملاحظة الزبون" strong={false}>{order.customerNotes}</Line></div>
        )}

        {/* Items */}
        <table className="mt-4">
          <thead>
            <tr className="bg-neutral-100 text-left text-[11px] uppercase">
              <th>Produit · <bdi dir="rtl">المنتج</bdi></th>
              <th>Couleur · <bdi dir="rtl">اللون</bdi></th>
              <th>Taille · <bdi dir="rtl">المقاس</bdi></th>
              <th>Matière · <bdi dir="rtl">الخامة</bdi></th>
              <th className="text-right">Qté</th>
              <th className="text-right">Prix unit.</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ item, material }) => (
              <tr key={item.id}>
                <td className="font-bold">{item.productName}<br /><span className="text-[10.5px] font-normal">{item.sku}</span></td>
                <td>{item.color}</td>
                <td className="font-bold">{item.size}</td>
                <td>{material || "—"}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right whitespace-nowrap">{da(item.unitPrice)}</td>
                <td className="text-right whitespace-nowrap">{da(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Money */}
        <section className="mt-4 ml-auto w-[80mm]">
          <table>
            <tbody>
              <tr><td>Articles ({units})</td><td className="text-right whitespace-nowrap">{da(order.subtotal)}</td></tr>
              {order.discountAmount > 0 && <tr><td>Remise · <bdi dir="rtl">تخفيض</bdi></td><td className="text-right whitespace-nowrap">− {da(order.discountAmount)}</td></tr>}
              <tr>
                <td>Livraison {order.deliveryType === "desk" ? "stop desk" : "à domicile"} · <bdi dir="rtl">التوصيل</bdi></td>
                <td className="text-right whitespace-nowrap">
                  {order.shipsWithOrderId ? "Groupée" : order.freeDelivery ? "Offerte" : order.deliveryFee > 0 ? da(order.deliveryFee) : "Par téléphone"}
                </td>
              </tr>
              <tr className="text-[15px] font-black">
                <td>À ENCAISSER · <bdi dir="rtl">المبلغ</bdi></td>
                <td className="text-right whitespace-nowrap">{da(order.subtotal - order.discountAmount + customerPays)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[11px]">Paiement à la livraison (cash) · <bdi dir="rtl">الدفع عند الاستلام</bdi></p>
        </section>

        <footer className="mt-8 grid grid-cols-2 gap-6 text-[11px]">
          <div className="border-t border-black pt-1">Signature boutique · <bdi dir="rtl">ختم المتجر</bdi></div>
          <div className="border-t border-black pt-1">Signature client · <bdi dir="rtl">توقيع الزبون</bdi></div>
        </footer>
      </article>
    </div>
  )
}

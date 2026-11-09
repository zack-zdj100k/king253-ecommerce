import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { referralLabel } from "@/lib/referral"

type Item = { productName: string; size: string; color: string; quantity: number; unitPrice: number; lineTotal: number }
export type EmailLocale = "ar" | "fr" | "en"
export type EmailOrder = {
  number: string
  status: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  wilayaName: string
  city: string
  address: string
  estimatedDays: string | null
  subtotal: number
  discountAmount: number
  deliveryFee: number
  freeDelivery: boolean
  deliveryType: "home" | "desk"
  deskName: string | null
  deskAddress: string | null
  referralSource: string | null
  /** Departure shop. */
  storeName: string | null
  /** Number of the earlier order this one is delivered with. */
  shipsWithNumber: string | null
  total: number
  customerNotes: string | null
  items: Item[]
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

function layout(brand: string, title: string, body: string, opts: { dir?: "rtl" | "ltr"; footer: string }) {
  const dir = opts.dir ?? "ltr"
  return `<!doctype html><html dir="${dir}"><body style="margin:0;background:#050505;font-family:Inter,Arial,Tahoma,sans-serif;color:#f5f5f5">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 12px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:600px;background:#0b0b0b;border:1px solid #222">
<tr><td style="padding:28px 32px;border-bottom:2px solid #a30d0d;text-align:${dir === "rtl" ? "right" : "left"}">
<div dir="ltr" style="font-size:20px;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase">${esc(brand.replace(/253$/, ""))}<span style="color:#d41414">${brand.endsWith("253") ? "253" : ""}</span></div>
<div style="margin-top:14px;font-size:26px;font-weight:700;text-transform:uppercase;letter-spacing:-0.5px">${esc(title)}</div>
</td></tr><tr><td style="padding:24px 32px;font-size:14px;line-height:1.7;color:#cfcfcf;text-align:${dir === "rtl" ? "right" : "left"}">${body}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #222;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#858585">${esc(opts.footer)}</td></tr>
</table></td></tr></table></body></html>`
}

/* ------------------------------------------------------------------ */
/* New order → the departure shop (French, like the admin)            */
/* ------------------------------------------------------------------ */

const SHOP_DELIVERY = { home: "À domicile", desk: "Stop desk" } as const

function shopFee(o: EmailOrder) {
  if (o.shipsWithNumber) return `groupée avec ${o.shipsWithNumber} (une seule livraison)`
  if (o.freeDelivery) return "offerte (payée par la boutique)"
  return o.deliveryFee > 0 ? formatDA(o.deliveryFee) : "à confirmer par téléphone"
}

export function shopNewOrderEmail(brand: string, o: EmailOrder, adminUrl: string) {
  const delivery = o.deliveryType === "desk" ? `${SHOP_DELIVERY.desk} — ${o.deskName ?? "?"}${o.deskAddress ? ` (${o.deskAddress})` : ""}` : SHOP_DELIVERY.home
  const subject = `Nouvelle commande ${o.number} — ${formatDA(o.total)} — ${o.wilayaName}`
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#858585;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;color:#f5f5f5">${value}</td></tr>`
  const items = o.items
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #1d1d1d">${esc(i.productName)}<br><span style="color:#858585;font-size:12px">${esc(i.color)} · taille ${esc(i.size)} × ${i.quantity}</span></td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #1d1d1d;white-space:nowrap">${formatDA(i.lineTotal)}</td></tr>`
    )
    .join("")
  const body = `<p style="margin:0 0 16px">Commande <strong style="color:#f5f5f5">${esc(o.number)}</strong> à expédier depuis <strong style="color:#f5f5f5">${esc(o.storeName ?? "—")}</strong>.</p>
<table cellpadding="0" cellspacing="0" style="font-size:14px">
${row("Client", esc(o.customerName))}
${row("Téléphone", `<a href="tel:${esc(o.customerPhone)}" style="color:#f5f5f5">${esc(formatPhone(o.customerPhone))}</a>`)}
${o.customerEmail ? row("Email", esc(o.customerEmail)) : ""}
${row("Wilaya / commune", `${esc(o.wilayaName)} — ${esc(o.city)}`)}
${row("Adresse", esc(o.address))}
${row("Livraison", esc(delivery))}
${row("Source", esc(referralLabel(o.referralSource)))}
${o.customerNotes ? row("Note du client", esc(o.customerNotes)) : ""}
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;font-size:14px;color:#cfcfcf">${items}
<tr><td style="padding:4px 0;color:#858585">Articles</td><td align="right">${formatDA(o.subtotal)}</td></tr>
${o.discountAmount ? `<tr><td style="padding:4px 0;color:#858585">Remise</td><td align="right">− ${formatDA(o.discountAmount)}</td></tr>` : ""}
<tr><td style="padding:4px 0;color:#858585">Livraison</td><td align="right">${esc(shopFee(o))}</td></tr>
<tr><td style="padding:4px 0;font-weight:700;color:#f5f5f5">Total à encaisser</td><td align="right" style="font-weight:700;color:#f5f5f5">${formatDA(o.total)}</td></tr></table>
<p style="margin:24px 0 0"><a href="${esc(adminUrl)}" style="display:inline-block;background:#a30d0d;color:#f5f5f5;padding:12px 20px;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase">Ouvrir la commande</a></p>`
  const text = [
    `Nouvelle commande ${o.number} — expédition depuis ${o.storeName ?? "—"}`,
    "",
    `Client : ${o.customerName} — ${formatPhone(o.customerPhone)}${o.customerEmail ? ` — ${o.customerEmail}` : ""}`,
    `Wilaya / commune : ${o.wilayaName} — ${o.city}`,
    `Adresse : ${o.address}`,
    `Livraison : ${delivery}`,
    `Source : ${referralLabel(o.referralSource)}`,
    o.customerNotes ? `Note : ${o.customerNotes}` : "",
    "",
    ...o.items.map((i) => `- ${i.productName} (${i.color}, taille ${i.size}) x${i.quantity} — ${formatDA(i.lineTotal)}`),
    `Livraison : ${shopFee(o)}`,
    `Total à encaisser : ${formatDA(o.total)}`,
    "",
    adminUrl,
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n")
  return { subject, html: layout(brand, "Nouvelle commande", body, { footer: `${brand} — ${o.storeName ?? ""}` }), text }
}

/* ------------------------------------------------------------------ */
/* Delivered → the customer, in their language (the only customer    */
/* email the shop sends)                                              */
/* ------------------------------------------------------------------ */

const DELIVERED: Record<EmailLocale, { subject: string; title: string; hi: string; intro: string; number: string; total: string; cta: string; footer: string }> = {
  en: {
    subject: "Your order has been delivered",
    title: "Delivered",
    hi: "Hi",
    intro: "Your order has been delivered. Thank you for choosing KING 253 — wear it well.",
    number: "Order number",
    total: "Paid on delivery",
    cta: "View your order",
    footer: "Built for the city",
  },
  fr: {
    subject: "Votre commande a été livrée",
    title: "Livrée",
    hi: "Bonjour",
    intro: "Votre commande a été livrée. Merci d’avoir choisi KING 253 — portez-la bien.",
    number: "Numéro de commande",
    total: "Payé à la livraison",
    cta: "Voir votre commande",
    footer: "Built for the city",
  },
  ar: {
    subject: "تم توصيل طلبك",
    title: "تم التوصيل",
    hi: "مرحبًا",
    intro: "تم توصيل طلبك. شكرًا لاختيارك KING 253 — البسها بفخر.",
    number: "رقم الطلب",
    total: "المبلغ المدفوع عند الاستلام",
    cta: "عرض طلبك",
    footer: "Built for the city",
  },
}

export function customerDeliveredEmail(brand: string, o: EmailOrder, orderUrl: string, locale: EmailLocale = "fr") {
  const c = DELIVERED[locale]
  const items = o.items.map((i) => `${esc(i.productName)} — ${esc(i.color)} / ${esc(i.size)} × ${i.quantity}`).join("<br>")
  const body = `<p style="margin:0 0 6px">${c.hi} ${esc(o.customerName.split(" ")[0])},</p>
<p style="margin:0 0 16px">${esc(c.intro)}</p>
<p style="margin:0 0 4px">${c.number}: <strong dir="ltr" style="color:#f5f5f5">${esc(o.number)}</strong></p>
<p style="margin:0 0 16px">${c.total}: <strong dir="ltr" style="color:#f5f5f5">${formatDA(o.total)}</strong></p>
<p style="margin:0 0 8px;color:#cfcfcf">${items}</p>
<p style="margin:24px 0 0"><a href="${esc(orderUrl)}" style="display:inline-block;background:#a30d0d;color:#f5f5f5;padding:12px 20px;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase">${c.cta}</a></p>`
  const text = [`${c.hi} ${o.customerName.split(" ")[0]},`, "", c.intro, `${c.number}: ${o.number}`, `${c.total}: ${formatDA(o.total)}`, "", orderUrl].join("\n")
  return {
    subject: `${c.subject} — ${o.number}`,
    html: layout(brand, c.title, body, { dir: locale === "ar" ? "rtl" : "ltr", footer: `${brand} — ${c.footer}` }),
    text,
  }
}

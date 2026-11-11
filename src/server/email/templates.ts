import { formatDA } from "@/lib/money"
import { formatPhone, whatsappLink } from "@/lib/phone"
import { referralLabel } from "@/lib/referral"

type Item = { productName: string; size: string; color: string; quantity: number; unitPrice: number; lineTotal: number; imageUrl?: string | null; sku?: string | null }
export type EmailLocale = "ar" | "fr" | "en"
export type EmailOrder = {
  number: string
  status: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  customerAge?: number | null
  createdAt?: Date | string | null
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
  return `<!doctype html><html dir="${dir}"><body style="margin:0;background:#050505;font-family:Helvetica,Arial,Tahoma,sans-serif;color:#f5f5f5">
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

function shopFee(o: EmailOrder) {
  if (o.shipsWithNumber) return `groupée avec ${o.shipsWithNumber} (une seule livraison)`
  if (o.freeDelivery) return "offerte (payée par la boutique)"
  return o.deliveryFee > 0 ? formatDA(o.deliveryFee) : "à confirmer par téléphone"
}

/** Phone for email bodies: plain digits, no bidi marks (some mail apps show them as boxes). */
const plainPhone = (e164: string) => formatPhone(e164).replace(/[\u2066-\u2069]/g, "")

/** Algeria time, e.g. "mer. 11 nov. 2026 · 18:42". */
function orderTime(d: Date | string | null | undefined) {
  if (!d) return ""
  const date = new Date(d)
  const day = date.toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers", weekday: "short", day: "numeric", month: "short", year: "numeric" })
  const time = date.toLocaleTimeString("fr-FR", { timeZone: "Africa/Algiers", hour: "2-digit", minute: "2-digit" })
  return `${day} · ${time}`
}

/**
 * New order → the departure shop. Built for the phone in the shop: total to collect and
 * one-tap "Call" / "WhatsApp" first, then delivery, articles with photos, and the totals.
 * Email-safe: tables + inline styles only.
 */
export function shopNewOrderEmail(brand: string, o: EmailOrder, adminUrl: string) {
  const origin = (() => {
    try {
      return new URL(adminUrl).origin
    } catch {
      return ""
    }
  })()
  const abs = (url: string | null | undefined) => (!url ? null : /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`)
  const phone = plainPhone(o.customerPhone)
  const tel = `tel:${o.customerPhone}`
  const wa = whatsappLink(o.customerPhone, `Bonjour ${o.customerName.split(" ")[0]}, ici ${brand}${o.storeName ? ` ${o.storeName}` : ""} — à propos de votre commande ${o.number}.`)
  const units = o.items.reduce((n, i) => n + i.quantity, 0)
  const deliveryLine =
    o.deliveryType === "desk"
      ? `Stop desk — ${o.deskName ?? "à confirmer"}${o.deskAddress ? `<br><span style="color:#9a9a9a">${esc(o.deskAddress)}</span>` : ""}`
      : "Livraison à domicile"
  const subject = `🛒 Nouvelle commande ${o.number} — ${formatDA(o.total)} — ${o.customerName} (${o.wilayaName})`

  const C = { bg: "#050505", card: "#0d0d0d", line: "#232323", text: "#f5f5f5", soft: "#cfcfcf", mute: "#8a8a8a", red: "#a30d0d", bright: "#d41414", green: "#1f8f4e" }
  const label = (t: string) => `<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.mute};margin:0 0 10px">${esc(t)}</div>`
  const section = (title: string, inner: string) =>
    `<tr><td style="padding:22px 28px;border-top:1px solid ${C.line}">${label(title)}${inner}</td></tr>`
  const kv = (k: string, v: string) =>
    `<tr><td style="padding:5px 14px 5px 0;color:${C.mute};font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;color:${C.text};font-size:14px;vertical-align:top">${v}</td></tr>`
  const button = (href: string, text: string, bg: string) =>
    `<a href="${esc(href)}" style="display:block;background:${bg};color:#ffffff;text-decoration:none;text-align:center;font-weight:700;font-size:15px;padding:15px 10px;border-radius:2px;white-space:nowrap">${text}</a>`

  const items = o.items
    .map((i) => {
      const img = abs(i.imageUrl)
      const photo = img
        ? `<img src="${esc(img)}" width="64" height="80" alt="" style="display:block;width:64px;height:80px;object-fit:cover;border:1px solid ${C.line};background:#151515">`
        : `<div style="width:64px;height:80px;background:#151515;border:1px solid ${C.line}"></div>`
      return `<tr>
<td width="76" style="padding:10px 12px 10px 0;border-bottom:1px solid ${C.line};vertical-align:top">${photo}</td>
<td style="padding:10px 0;border-bottom:1px solid ${C.line};vertical-align:top;font-size:14px;color:${C.text}">
<strong>${esc(i.productName)}</strong><br>
<span style="color:${C.soft};font-size:13px">Couleur : ${esc(i.color)}<br>Taille : <strong style="color:${C.text}">${esc(i.size)}</strong> · Quantité : <strong style="color:${C.text}">${i.quantity}</strong></span><br>
<span style="color:${C.mute};font-size:12px">${i.quantity} × ${formatDA(i.unitPrice)}${i.sku ? ` · ${esc(i.sku)}` : ""}</span></td>
<td align="right" style="padding:10px 0 10px 10px;border-bottom:1px solid ${C.line};vertical-align:top;white-space:nowrap;font-size:14px;color:${C.text};font-weight:700">${formatDA(i.lineTotal)}</td>
</tr>`
    })
    .join("")

  const total = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:5px 0;font-size:${strong ? 16 : 14}px;color:${strong ? C.text : C.mute};font-weight:${strong ? 800 : 400}">${esc(k)}</td><td align="right" style="padding:5px 0;font-size:${strong ? 20 : 14}px;color:${strong ? C.text : C.soft};font-weight:${strong ? 800 : 400};white-space:nowrap">${v}</td></tr>`

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Helvetica,Arial,Tahoma,sans-serif;color:${C.text}">
<div style="display:none;max-height:0;overflow:hidden;color:${C.bg}">${esc(`${o.customerName} · ${phone} · ${o.wilayaName} · ${formatDA(o.total)} à encaisser`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 10px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.line}">

<tr><td style="padding:22px 28px;border-top:3px solid ${C.bright}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:20px;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;color:${C.text}">${esc(brand.replace(/253$/, ""))}<span style="color:${C.bright}">${brand.endsWith("253") ? "253" : ""}</span></td>
<td align="right" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.mute}">${esc(o.storeName ?? "")}</td>
</tr></table>
<div style="margin-top:18px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${C.bright};font-weight:700">● Nouvelle commande</div>
<div style="margin-top:6px;font-size:26px;font-weight:900;letter-spacing:-0.5px;color:${C.text}">${esc(o.number)}</div>
<div style="margin-top:4px;font-size:13px;color:${C.mute}">${esc(orderTime(o.createdAt))}${o.storeName ? ` · Expédier depuis <strong style="color:${C.soft}">${esc(o.storeName)}</strong>` : ""}</div>
</td></tr>

<tr><td style="padding:0 28px 22px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#140707;border:1px solid #3a1212"><tr>
<td style="padding:16px 18px"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d48a8a">Total à encaisser · paiement à la livraison</div>
<div style="margin-top:4px;font-size:30px;font-weight:900;color:#ffffff;white-space:nowrap">${formatDA(o.total)}</div>
<div style="margin-top:2px;font-size:13px;color:${C.soft}">${units} article${units > 1 ? "s" : ""} · ${esc(o.deliveryType === "desk" ? "Stop desk" : "À domicile")} · ${esc(o.wilayaName)}</div></td>
</tr></table>
</td></tr>

${section(
  "Client — appeler pour confirmer",
  `<div style="font-size:20px;font-weight:800;color:${C.text}">${esc(o.customerName)}</div>
<div style="margin-top:4px;font-size:22px;font-weight:700;letter-spacing:1px"><a href="${esc(tel)}" style="color:${C.text};text-decoration:none">${esc(phone)}</a></div>
${o.customerEmail ? `<div style="margin-top:2px;font-size:13px;color:${C.mute}">${esc(o.customerEmail)}</div>` : ""}
${o.customerAge ? `<div style="margin-top:2px;font-size:13px;color:${C.mute}">${o.customerAge} ans</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
<td width="50%" style="padding-right:6px">${button(tel, "📞 Appeler", C.red)}</td>
<td width="50%" style="padding-left:6px">${button(wa, "💬 WhatsApp", C.green)}</td>
</tr></table>`
)}

${section(
  "Livraison",
  `<table role="presentation" cellpadding="0" cellspacing="0">
${kv("Mode", deliveryLine)}
${kv("Wilaya", esc(o.wilayaName))}
${kv("Commune", esc(o.city))}
${kv("Adresse", esc(o.address))}
${kv("Frais", esc(shopFee(o)))}
${o.estimatedDays ? kv("Délai", esc(o.estimatedDays)) : ""}
</table>`
)}

${
  o.customerNotes
    ? `<tr><td style="padding:0 28px 22px"><div style="border-left:3px solid ${C.bright};background:#121212;padding:12px 14px;font-size:14px;color:${C.text}"><span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.mute}">Note du client</span><br>${esc(o.customerNotes)}</div></td></tr>`
    : ""
}

${section(
  `Articles (${units})`,
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
${total("Articles", formatDA(o.subtotal))}
${o.discountAmount ? total("Remise", `− ${formatDA(o.discountAmount)}`) : ""}
${total("Livraison", esc(shopFee(o)))}
<tr><td colspan="2" style="border-top:1px solid ${C.line};padding-top:6px"></td></tr>
${total("Total à encaisser", formatDA(o.total), true)}
</table>`
)}

${section(
  "Infos",
  `<table role="presentation" cellpadding="0" cellspacing="0">
${kv("Paiement", "À la livraison (cash)")}
${kv("Source", esc(referralLabel(o.referralSource)))}
${o.shipsWithNumber ? kv("Groupée avec", esc(o.shipsWithNumber)) : ""}
</table>`
)}

<tr><td style="padding:6px 28px 26px">${button(adminUrl, "Ouvrir la commande dans l’admin →", "#1a1a1a")}</td></tr>

<tr><td style="padding:16px 28px;border-top:1px solid ${C.line};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.mute}">${esc(brand)}${o.storeName ? ` — ${esc(o.storeName)}` : ""} · Envoyé uniquement à cette boutique</td></tr>
</table></td></tr></table></body></html>`

  const text = [
    `NOUVELLE COMMANDE ${o.number} — ${orderTime(o.createdAt)}`,
    `Expédier depuis : ${o.storeName ?? "—"}`,
    `TOTAL À ENCAISSER : ${formatDA(o.total)} (paiement à la livraison)`,
    "",
    `Client : ${o.customerName}`,
    `Téléphone : ${phone}  (appeler : ${tel})`,
    `WhatsApp : ${wa}`,
    o.customerEmail ? `Email : ${o.customerEmail}` : "",
    "",
    `Livraison : ${o.deliveryType === "desk" ? `Stop desk — ${o.deskName ?? "à confirmer"}${o.deskAddress ? ` (${o.deskAddress})` : ""}` : "À domicile"}`,
    `Wilaya : ${o.wilayaName} — Commune : ${o.city}`,
    `Adresse : ${o.address}`,
    `Frais : ${shopFee(o)}`,
    o.customerNotes ? `Note du client : ${o.customerNotes}` : "",
    "",
    ...o.items.map((i) => `- ${i.productName} — ${i.color}, taille ${i.size}, x${i.quantity} — ${formatDA(i.lineTotal)}`),
    `Articles : ${formatDA(o.subtotal)}`,
    o.discountAmount ? `Remise : − ${formatDA(o.discountAmount)}` : "",
    `Livraison : ${shopFee(o)}`,
    `Total à encaisser : ${formatDA(o.total)}`,
    `Source : ${referralLabel(o.referralSource)}`,
    "",
    adminUrl,
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n")
  return { subject, html, text }
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

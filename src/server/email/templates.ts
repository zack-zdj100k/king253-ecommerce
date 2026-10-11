import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"

type Item = { productName: string; size: string; color: string; quantity: number; unitPrice: number; lineTotal: number }
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
  /** Number of the earlier order this one is delivered with. */
  shipsWithNumber: string | null
  total: number
  customerNotes: string | null
  items: Item[]
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

function layout(brand: string, title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#050505;font-family:Inter,Arial,sans-serif;color:#f5f5f5">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 12px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0b0b0b;border:1px solid #222">
<tr><td style="padding:28px 32px;border-bottom:2px solid #a30d0d">
<div style="font-size:20px;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase">${esc(brand.replace(/253$/, ""))}<span style="color:#d41414">${brand.endsWith("253") ? "253" : ""}</span></div>
<div style="margin-top:14px;font-size:26px;font-weight:700;text-transform:uppercase;letter-spacing:-0.5px">${esc(title)}</div>
</td></tr><tr><td style="padding:24px 32px;font-size:14px;line-height:1.6;color:#cfcfcf">${body}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #222;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#858585">${esc(brand)} — Built for the city</td></tr>
</table></td></tr></table></body></html>`
}

function itemsTable(o: EmailOrder) {
  const rows = o.items
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #1d1d1d">${esc(i.productName)}<br><span style="color:#858585;font-size:12px">${esc(i.color)} / ${esc(i.size)} × ${i.quantity}</span></td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #1d1d1d;white-space:nowrap">${formatDA(i.lineTotal)}</td></tr>`
    )
    .join("")
  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;color:${strong ? "#f5f5f5" : "#858585"}">${label}</td><td align="right" style="padding:4px 0;${strong ? "font-weight:700;color:#f5f5f5" : ""}">${value}</td></tr>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#cfcfcf">${rows}
${line("Clothes", formatDA(o.subtotal))}
${o.discountAmount ? line("Discount", `− ${formatDA(o.discountAmount)}`) : ""}
${line("Delivery", deliveryLabel(o))}
${line("To pay on delivery", formatDA(o.total), true)}</table>`
}

function deliveryLabel(o: EmailOrder) {
  if (o.shipsWithNumber) return `shared with ${o.shipsWithNumber} (one delivery)`
  if (o.freeDelivery) return "free"
  return o.deliveryFee > 0 ? formatDA(o.deliveryFee) : "confirmed by phone"
}

function deliveryBlock(o: EmailOrder) {
  return `<p style="margin:18px 0 0">${esc(o.customerName)} · ${esc(formatPhone(o.customerPhone))}<br>${esc(o.address)}, ${esc(o.city)}, ${esc(o.wilayaName)}${o.estimatedDays ? `<br>Estimated delivery: ${esc(o.estimatedDays)}` : ""}</p>`
}

function text(o: EmailOrder, intro: string) {
  return [
    intro,
    "",
    ...o.items.map((i) => `- ${i.productName} (${i.color} / ${i.size}) x${i.quantity} — ${formatDA(i.lineTotal)}`),
    `Clothes: ${formatDA(o.subtotal)}`,
    o.discountAmount ? `Discount: -${formatDA(o.discountAmount)}` : "",
    `Delivery: ${deliveryLabel(o)}`,
    `To pay on delivery: ${formatDA(o.total)}`,
    "",
    `${o.customerName} — ${formatPhone(o.customerPhone)}`,
    `${o.address}, ${o.city}, ${o.wilayaName}`,
  ]
    .filter((l) => l !== "")
    .join("\n")
}

export function adminNewOrderEmail(brand: string, o: EmailOrder, adminUrl: string) {
  const subject = `New order ${o.number} — ${formatDA(o.total)} — ${o.wilayaName}`
  const body = `<p style="margin:0 0 16px">Order <strong style="color:#f5f5f5">${esc(o.number)}</strong> was just placed.</p>
${itemsTable(o)}${deliveryBlock(o)}
${o.customerEmail ? `<p style="margin:8px 0 0">Email: ${esc(o.customerEmail)}</p>` : ""}
${o.customerNotes ? `<p style="margin:8px 0 0">Customer notes: ${esc(o.customerNotes)}</p>` : ""}
<p style="margin:24px 0 0"><a href="${esc(adminUrl)}" style="display:inline-block;background:#a30d0d;color:#f5f5f5;padding:12px 20px;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase">Open order</a></p>`
  return { subject, html: layout(brand, "New order", body), text: text(o, `New order ${o.number}`) }
}

const CUSTOMER_COPY: Record<string, { subject: string; title: string; intro: string }> = {
  received: { subject: "We received your order", title: "Order received", intro: "Thanks — your order is in. We will call you to confirm it before preparing your pieces." },
  confirmed: { subject: "Your order is confirmed", title: "Order confirmed", intro: "Your order is confirmed. We are getting it ready." },
  preparing: { subject: "Your order is being prepared", title: "Preparing", intro: "Your pieces are being prepared." },
  ready_for_delivery: { subject: "Your order is ready for delivery", title: "Ready for delivery", intro: "Your order is packed and handed to delivery. Keep your phone close." },
  delivered: { subject: "Your order was delivered", title: "Delivered", intro: "Your order has been delivered. Wear it well." },
}

export type CustomerEmailEvent = keyof typeof CUSTOMER_COPY

export function customerOrderEmail(brand: string, event: CustomerEmailEvent, o: EmailOrder, trackUrl: string) {
  const copy = CUSTOMER_COPY[event]
  const body = `<p style="margin:0 0 6px">Hi ${esc(o.customerName.split(" ")[0])},</p>
<p style="margin:0 0 16px">${esc(copy.intro)}</p>
<p style="margin:0 0 16px">Order number: <strong style="color:#f5f5f5">${esc(o.number)}</strong></p>
${itemsTable(o)}${deliveryBlock(o)}
<p style="margin:24px 0 0"><a href="${esc(trackUrl)}" style="display:inline-block;background:#a30d0d;color:#f5f5f5;padding:12px 20px;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase">Track your order</a></p>`
  return { subject: `${copy.subject} — ${o.number}`, html: layout(brand, copy.title, body), text: text(o, `${copy.intro}\nOrder number: ${o.number}`) }
}

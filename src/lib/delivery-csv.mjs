// Delivery price lists (CSV) → rows, shared by Admin → Delivery (upload) and
// scripts/import-delivery.mjs (terminal). Plain JS so both can use it.
//
// rates.csv  : shop,wilaya,home_price,desk_price
// desks.csv  : shop,wilaya,commune,name,address,desk_price
//
// shop   = the shop's short code (Admin → Shops, e.g. "annaba")
// wilaya = code ("16"), "16 - Alger", French or Arabic name
// price  = whole DA; empty = not offered (rates) / the wilaya's desk price (desks)
// Separator: comma or semicolon (Excel in French uses ";"). First line = header.

/** Case/accent-insensitive key, same rule as src/lib/algeria.ts placeKey. */
export const placeKey = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/** Split CSV text into rows of cells (quotes, "" escapes, CRLF, BOM). */
export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, "")
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ""
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","
  const rows = []
  let row = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) {
      row.push(cell.trim())
      cell = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++
      row.push(cell.trim())
      if (row.some((x) => x !== "")) rows.push(row)
      row = []
      cell = ""
    } else cell += c
  }
  row.push(cell.trim())
  if (row.some((x) => x !== "")) rows.push(row)
  return rows
}

/**
 * @param {{ code: number, fr: string, ar: string }[]} wilayas
 * @param {string} value
 */
export function matchWilaya(wilayas, value) {
  const raw = String(value ?? "").trim()
  const code = raw.match(/^(\d{1,2})\b/)?.[1]
  if (code) return wilayas.find((w) => w.code === Number(code)) ?? null
  const k = placeKey(raw)
  return wilayas.find((w) => placeKey(w.fr) === k || w.ar === raw) ?? null
}

/** "1 200", "1200 DA", "1.200,00" → 1200; "" → null; anything else → NaN. */
export function parsePrice(value) {
  const raw = String(value ?? "")
    .replace(/da|dzd|دج/gi, "")
    .replace(/[\s ]/g, "")
    .replace(/[.,]00$/, "")
    .replace(/[.,](?=\d{3}\b)/g, "")
  if (raw === "" || raw === "-") return null
  return /^\d{1,7}$/.test(raw) ? Number(raw) : NaN
}

const HEADERS = {
  rates: ["shop", "wilaya", "home_price", "desk_price"],
  desks: ["shop", "wilaya", "commune", "name", "address", "desk_price"],
}

/**
 * Validates a whole file. Nothing is imported when `errors` is not empty.
 * @param {"rates"|"desks"} kind
 * @param {string} text
 * @param {{ shops: { id: number, slug: string }[], wilayas: { code: number, fr: string, ar: string }[] }} ref
 */
export function readDeliveryCsv(kind, text, ref) {
  const rows = parseCsv(text)
  const errors = []
  const out = []
  if (!rows.length) return { rows: out, errors: ["The file is empty."] }
  const header = rows[0].map((h) => placeKey(h).replace(/ /g, "_"))
  const want = HEADERS[kind]
  const col = Object.fromEntries(want.map((h) => [h, header.indexOf(h)]))
  const missing = want.filter((h) => col[h] === -1 && !(kind === "desks" && (h === "address" || h === "desk_price")))
  if (missing.length) return { rows: out, errors: [`Missing column(s): ${missing.join(", ")}. Expected: ${want.join(",")}`] }

  rows.slice(1).forEach((cells, i) => {
    const line = i + 2
    const get = (h) => (col[h] >= 0 ? (cells[col[h]] ?? "").trim() : "")
    const shop = ref.shops.find((s) => s.slug === placeKey(get("shop")).replace(/ /g, "-"))
    if (!shop) return errors.push(`Line ${line}: unknown shop "${get("shop")}" (use the short code from Admin → Shops).`)
    const wilaya = matchWilaya(ref.wilayas, get("wilaya"))
    if (!wilaya) return errors.push(`Line ${line}: unknown wilaya "${get("wilaya")}".`)
    if (kind === "rates") {
      const homePrice = parsePrice(get("home_price"))
      const deskPrice = parsePrice(get("desk_price"))
      if (Number.isNaN(homePrice) || Number.isNaN(deskPrice)) return errors.push(`Line ${line}: prices must be whole DA amounts.`)
      out.push({ storeId: shop.id, wilayaCode: wilaya.code, homePrice, deskPrice })
    } else {
      const name = get("name")
      const commune = get("commune")
      const deskPrice = parsePrice(get("desk_price"))
      if (!name) return errors.push(`Line ${line}: the desk needs a name.`)
      if (!commune) return errors.push(`Line ${line}: the desk needs a commune.`)
      if (Number.isNaN(deskPrice)) return errors.push(`Line ${line}: desk_price must be a whole DA amount or empty.`)
      out.push({ storeId: shop.id, wilayaCode: wilaya.code, commune, name, address: get("address"), deskPrice })
    }
  })
  return { rows: out, errors }
}

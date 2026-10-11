import data from "./algeria-data.json"

/**
 * Algeria's 69 wilayas and 1,541 communes (official since Law 26-06, JO n°25
 * of 5 April 2026). Source and licence are recorded in algeria-data.json.
 */
export type Wilaya = { code: number; fr: string; ar: string; communes: [fr: string, ar: string][] }

export const WILAYAS = data.wilayas as Wilaya[]

/** Case/accent-insensitive key: "BÉJAÏA", "bejaia " → "bejaia". */
export const placeKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/** Accepts "Alger", "16", "16 - Alger" or the Arabic name. */
export function findWilaya(value: string | null | undefined): Wilaya | null {
  if (!value) return null
  const raw = value.trim()
  const code = raw.match(/^(\d{1,2})\b/)?.[1]
  if (code) return WILAYAS.find((w) => w.code === Number(code)) ?? null
  const k = placeKey(raw)
  return WILAYAS.find((w) => placeKey(w.fr) === k || w.ar === raw) ?? null
}

/** The commune's official French name in that wilaya, or null if it isn't one of its communes. */
export function findCommune(wilaya: Wilaya, value: string | null | undefined): string | null {
  if (!value) return null
  const k = placeKey(value)
  return wilaya.communes.find(([fr, ar]) => placeKey(fr) === k || ar === value.trim())?.[0] ?? null
}

export const wilayaLabel = (w: Wilaya) => `${String(w.code).padStart(2, "0")} — ${w.fr}`

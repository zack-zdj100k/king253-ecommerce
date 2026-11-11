import "server-only"

import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { products } from "./db/schema"

/**
 * Automatic translation of product texts (Arabic, French, English).
 *
 * The admin writes each text once, in any of the three languages. On save, the texts are sent to
 * DeepL (env DEEPL_API_KEY; free keys end in ":fx") and the three versions are stored on the
 * product. The shop shows the visitor's language and falls back to the text as written.
 * No key, or DeepL unreachable → nothing changes; the product is still saved.
 */

export const TRANSLATED_FIELDS = [
  "shortDescription",
  "description",
  "material",
  "quality",
  "fit",
  "style",
  "care",
  "story",
  "inspiration",
  "brandNote",
  "seoDescription",
] as const
export type TranslatedField = (typeof TRANSLATED_FIELDS)[number]
type Locale = "ar" | "fr" | "en"
const TARGETS: Record<Locale, string> = { ar: "AR", fr: "FR", en: "EN-GB" }

export function translationReady() {
  return !!process.env.DEEPL_API_KEY
}

function endpoint(key: string) {
  return key.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate"
}

/** One DeepL call for several texts into one language. Returns translations + detected source language. */
async function deepl(texts: string[], target: string, key: string) {
  const res = await fetch(endpoint(key), {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texts, target_lang: target, preserve_formatting: true }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { translations: { text: string; detected_source_language: string }[] }
  return data.translations
}

const sourceHash = (src: Partial<Record<TranslatedField, string>>) => createHash("sha256").update(JSON.stringify(src)).digest("hex").slice(0, 16)

/**
 * Translates one product's texts into the three languages (skipped when the texts did not change).
 * Returns what happened, for the admin message.
 */
export async function translateProduct(db: DbOrTx, productId: string, opts: { force?: boolean } = {}): Promise<"translated" | "unchanged" | "no-key" | "empty"> {
  const key = process.env.DEEPL_API_KEY
  if (!key) return "no-key"
  const [p] = await db.select().from(products).where(eq(products.id, productId))
  if (!p) return "empty"
  const src: Partial<Record<TranslatedField, string>> = {}
  for (const f of TRANSLATED_FIELDS) {
    const v = p[f]
    if (typeof v === "string" && v.trim()) src[f] = v
  }
  const fields = Object.keys(src) as TranslatedField[]
  if (!fields.length) return "empty"
  const hash = sourceHash(src)
  if (!opts.force && p.translations?._source === hash) return "unchanged"

  const out: Record<string, Record<string, string> | string> = { _source: hash }
  for (const [locale, target] of Object.entries(TARGETS) as [Locale, string][]) {
    const res = await deepl(fields.map((f) => src[f]!), target, key)
    const detected = res[0]?.detected_source_language?.toLowerCase().slice(0, 2)
    // The language the admin wrote in keeps the original words.
    out[locale] = Object.fromEntries(fields.map((f, i) => [f, detected === locale ? src[f]! : res[i]?.text ?? src[f]!]))
  }
  await db.update(products).set({ translations: out }).where(eq(products.id, productId))
  return "translated"
}

/** The product with its texts in the visitor's language (original text where no translation exists). */
export function localizeProduct<P extends Record<string, unknown> & { translations?: Record<string, Record<string, string> | string> | null }>(p: P, locale: string): P {
  const t = p.translations?.[locale]
  if (!t || typeof t !== "object") return p
  const copy: Record<string, unknown> = { ...p }
  for (const f of TRANSLATED_FIELDS) if (typeof t[f] === "string" && t[f].trim() && typeof p[f] === "string" && (p[f] as string).trim()) copy[f] = t[f]
  return copy as P
}

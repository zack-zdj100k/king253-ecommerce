import "server-only"

import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { categories, products, testimonials } from "./db/schema"
import { AppError } from "./errors"

/**
 * Automatic translation of the website's texts (Arabic, French, English).
 *
 * The admin writes each text once, in any of the three languages. On save, the texts are sent to
 * DeepL (env DEEPL_API_KEY; free keys end in ":fx") and the three versions are stored next to the
 * original. The shop shows the visitor's language and falls back to the text as written.
 * No key, or DeepL unreachable → nothing changes; the item is still saved.
 *
 * Covered: product descriptions, category names and taglines, testimonials, and the page texts of
 * Admin → Content (see content-translate.ts).
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
export const CATEGORY_FIELDS = ["name", "tagline"] as const
export const TESTIMONIAL_FIELDS = ["quote", "role"] as const

export type Locale = "ar" | "fr" | "en"
export const LOCALES: Locale[] = ["ar", "fr", "en"]
const TARGETS: Record<Locale, string> = { ar: "AR", fr: "FR", en: "EN-GB" }
const SOURCES: Record<Locale, string> = { ar: "AR", fr: "FR", en: "EN" }

export type TranslationOutcome = "translated" | "unchanged" | "no-key" | "empty"
type Stored = Record<string, Record<string, string> | string>

export function translationReady() {
  return !!process.env.DEEPL_API_KEY
}

function endpoint(key: string) {
  return key.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate"
}

/** What went wrong at DeepL, in words the admin can act on (never includes the key). */
export function deeplProblem(status: number): string {
  if (status === 403 || status === 401) return "DeepL refused the key. Check DEEPL_API_KEY in the server .env."
  if (status === 456) return "The DeepL monthly limit is used up. It resets next month (or upgrade the DeepL plan)."
  if (status === 429 || status === 529) return "DeepL is busy. Wait a minute and try again."
  if (status === 400) return "DeepL did not accept one of the texts (language or size)."
  return `DeepL answered with an error (${status}).`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** First wait after a "too many requests" answer (doubles each retry). Tests set it to 1 ms. */
export let RETRY_BASE_MS = 1000
export function setRetryBaseForTests(ms: number) {
  RETRY_BASE_MS = ms
}

/** One DeepL call for several texts into one language. Returns translations + detected source language. */
async function deepl(texts: string[], target: string, key: string, source?: string) {
  let res: Response | undefined
  // DeepL answers 429/529 when requests come too fast (the free plan is strict): wait and retry,
  // as DeepL asks (Retry-After when given, otherwise 1 s, 2 s, 4 s, 8 s).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      res = await fetch(endpoint(key), {
        method: "POST",
        headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: texts, target_lang: target, ...(source ? { source_lang: source } : {}), preserve_formatting: true }),
        signal: AbortSignal.timeout(20_000),
      })
    } catch (cause) {
      throw new AppError("TRANSLATION_FATAL", "Could not reach DeepL (network problem or timeout). Try again in a minute.", { cause })
    }
    if ((res.status !== 429 && res.status !== 529) || attempt === 4) break
    const after = Number(res.headers.get("retry-after"))
    await sleep(Number.isFinite(after) && after > 0 ? Math.min(after, 10) * 1000 : RETRY_BASE_MS * 2 ** attempt)
  }
  res = res!
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200)
    // Key, limit and network problems repeat for every item: callers stop at the first one.
    const fatal = [401, 403, 429, 456, 529].includes(res.status)
    throw new AppError(fatal ? "TRANSLATION_FATAL" : "TRANSLATION_FAILED", deeplProblem(res.status), { detail: `DeepL ${res.status}: ${body}` })
  }
  const data = (await res.json()) as { translations: { text: string; detected_source_language: string }[] }
  return data.translations
}

/** Plain texts into one language (used for page texts). Texts without letters are returned as they are. */
export async function translateTexts(texts: string[], to: Locale, from?: Locale): Promise<string[]> {
  const key = process.env.DEEPL_API_KEY
  if (!key) throw new AppError("NO_TRANSLATION_KEY", "Translation is not set up yet (DEEPL_API_KEY in the server .env).")
  const idx = texts.map((t, i) => (hasLetters(t) ? i : -1)).filter((i) => i >= 0)
  if (!idx.length || from === to) return texts
  const res = await deepl(idx.map((i) => texts[i]), TARGETS[to], key, from ? SOURCES[from] : undefined)
  const out = [...texts]
  idx.forEach((i, n) => {
    out[i] = res[n]?.text ?? texts[i]
  })
  return out
}

const sourceHash = (src: Record<string, string>) => createHash("sha256").update(JSON.stringify(src)).digest("hex").slice(0, 16)

/** A text worth sending to DeepL: has at least one letter (not "." or "01"). */
export const hasLetters = (s: string) => /\p{L}/u.test(s)

/**
 * Translates a set of fields into all three languages. The language the admin wrote in keeps the
 * original words (detected by DeepL, or given as `from`).
 */
export async function translateSet(src: Record<string, string>, key: string, from?: Locale): Promise<Record<Locale, Record<string, string>>> {
  const fields = Object.keys(src)
  const out = {} as Record<Locale, Record<string, string>>
  for (const locale of LOCALES) {
    if (from === locale) {
      out[locale] = { ...src }
      continue
    }
    const res = await deepl(fields.map((f) => src[f]), TARGETS[locale], key, from ? SOURCES[from] : undefined)
    const detected = res[0]?.detected_source_language?.toLowerCase().slice(0, 2)
    out[locale] = Object.fromEntries(fields.map((f, i) => [f, detected === locale ? src[f] : (res[i]?.text ?? src[f])]))
  }
  return out
}

function pickSource<T extends Record<string, unknown>>(row: T, fields: readonly string[]) {
  const src: Record<string, string> = {}
  for (const f of fields) {
    const v = row[f]
    if (typeof v === "string" && v.trim()) src[f] = v
  }
  return src
}

/** Shared by products, categories and testimonials: translate when the texts changed, return what to store. */
async function buildStored(row: Record<string, unknown>, existing: Stored | null | undefined, fields: readonly string[], force: boolean): Promise<TranslationOutcome | { stored: Stored }> {
  const key = process.env.DEEPL_API_KEY
  if (!key) return "no-key"
  const src = pickSource(row, fields)
  if (!Object.keys(src).length) return "empty"
  const hash = sourceHash(src)
  if (!force && existing?._source === hash) return "unchanged"
  const sets = await translateSet(src, key)
  return { stored: { _source: hash, ...sets } }
}

export async function translateProduct(db: DbOrTx, productId: string, opts: { force?: boolean } = {}): Promise<TranslationOutcome> {
  const [p] = await db.select().from(products).where(eq(products.id, productId))
  if (!p) return "empty"
  const r = await buildStored(p, p.translations, TRANSLATED_FIELDS, !!opts.force)
  if (typeof r === "string") return r
  await db.update(products).set({ translations: r.stored }).where(eq(products.id, productId))
  return "translated"
}

export async function translateCategory(db: DbOrTx, categoryId: number, opts: { force?: boolean } = {}): Promise<TranslationOutcome> {
  const [c] = await db.select().from(categories).where(eq(categories.id, categoryId))
  if (!c) return "empty"
  const r = await buildStored(c, c.translations, CATEGORY_FIELDS, !!opts.force)
  if (typeof r === "string") return r
  await db.update(categories).set({ translations: r.stored }).where(eq(categories.id, categoryId))
  return "translated"
}

export async function translateTestimonial(db: DbOrTx, testimonialId: string, opts: { force?: boolean } = {}): Promise<TranslationOutcome> {
  const [t] = await db.select().from(testimonials).where(eq(testimonials.id, testimonialId))
  if (!t) return "empty"
  const r = await buildStored(t, t.translations, TESTIMONIAL_FIELDS, !!opts.force)
  if (typeof r === "string") return r
  await db.update(testimonials).set({ translations: r.stored }).where(eq(testimonials.id, testimonialId))
  return "translated"
}

/** Same row with the listed texts in the visitor's language (original text where no translation exists). */
export function localizeFields<P extends Record<string, unknown>>(p: P, translations: unknown, locale: string, fields: readonly string[]): P {
  const t = (translations as Stored | null | undefined)?.[locale]
  if (!t || typeof t !== "object") return p
  const copy: Record<string, unknown> = { ...p }
  for (const f of fields) if (typeof t[f] === "string" && t[f].trim() && typeof p[f] === "string" && (p[f] as string).trim()) copy[f] = t[f]
  return copy as P
}

/** The product with its texts in the visitor's language. */
export function localizeProduct<P extends Record<string, unknown> & { translations?: Stored | null }>(p: P, locale: string): P {
  return localizeFields(p, p.translations, locale, TRANSLATED_FIELDS)
}

/** Short reason for the admin when an automatic translation failed (the real error goes to the server log). */
export function translationReason(e: unknown): string {
  console.error("[king253] translation failed", e)
  return e instanceof AppError ? e.userMessage : "unexpected problem (details are in the server log)."
}

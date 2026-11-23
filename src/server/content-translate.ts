import "server-only"

import { eq } from "drizzle-orm"

import { CONTENT_SECTIONS, getContent, rowKey, saveContent, type ContentKey, type ContentLocale } from "./content"
import type { DbOrTx } from "./db/client"
import { contentBlocks } from "./db/schema"
import { hasLetters, LOCALES, translateTexts } from "./translate"

/**
 * Automatic translation of the page texts in Admin → Content.
 * The admin edits a section in one language; the texts that changed are translated into the two
 * other languages and stored there. Images are shared and never touched.
 */

const TEXT_TYPES = new Set(["text", "textarea", "lines"])

/** Translates one field value; multi-line fields are translated line by line so the layout stays. */
async function translateValue(value: string, type: string, to: ContentLocale, from: ContentLocale) {
  if (type !== "lines") return (await translateTexts([value], to, from))[0]
  const parts = value.split("\n")
  return (await translateTexts(parts, to, from)).join("\n")
}

/**
 * `previous` = what the editor showed before the change, `saved` = what was saved.
 * `onlyMissing` fills only languages that have no text for the field (used by "Translate everything").
 * Returns how many field translations were stored.
 */
export async function translateContentChange(
  db: DbOrTx,
  key: ContentKey,
  from: ContentLocale,
  previous: Record<string, string>,
  saved: Record<string, string>,
  opts: { onlyMissing?: boolean } = {}
): Promise<number> {
  const fields = CONTENT_SECTIONS[key].fields.filter((f) => TEXT_TYPES.has(f.type))
  const changed = fields.filter((f) => {
    const v = saved[f.name]
    return typeof v === "string" && v.trim() !== "" && hasLetters(v) && v !== previous[f.name]
  })
  if (!changed.length) return 0

  let stored = 0
  for (const to of LOCALES.filter((l) => l !== from)) {
    const [row] = await db.select().from(contentBlocks).where(eq(contentBlocks.key, rowKey(key, to)))
    const existing = (row?.data ?? {}) as Record<string, string>
    const todo = opts.onlyMissing ? changed.filter((f) => !(typeof existing[f.name] === "string" && existing[f.name].trim())) : changed
    if (!todo.length) continue
    const merged: Record<string, string> = { ...existing }
    for (const f of todo) merged[f.name] = await translateValue(saved[f.name], f.type, to, from)
    await saveContent(db, key, merged, to)
    stored += todo.length
  }
  return stored
}

/** The texts the editor shows for a section in a language (admin text, built-in translation or default). */
export async function shownContent(db: DbOrTx, key: ContentKey, locale: ContentLocale) {
  return (await getContent(db, key, locale)) as Record<string, string>
}

/** Every section the admin has edited in English: fill the French and Arabic texts that are still empty. */
export async function translateAllContent(db: DbOrTx, budgetUntil: number): Promise<{ done: number; failures: string[]; stopped: boolean }> {
  let done = 0
  const failures: string[] = []
  const rows = await db.select().from(contentBlocks)
  for (const row of rows) {
    if (row.key.includes("@") || !(row.key in CONTENT_SECTIONS)) continue
    if (Date.now() > budgetUntil) return { done, failures, stopped: true }
    const key = row.key as ContentKey
    try {
      const defaults = CONTENT_SECTIONS[key].defaults as Record<string, string>
      done += await translateContentChange(db, key, "en", defaults, row.data as Record<string, string>, { onlyMissing: true })
    } catch (e) {
      failures.push(`${CONTENT_SECTIONS[key].label}: ${e instanceof Error ? (e as { userMessage?: string }).userMessage ?? e.message : String(e)}`)
    }
  }
  return { done, failures, stopped: false }
}

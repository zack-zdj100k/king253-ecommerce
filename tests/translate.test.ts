import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { categories, products, testimonials } from "@/server/db/schema"
import { getProductPage } from "@/server/catalog"
import { getContent, saveContent } from "@/server/content"
import { translateContentChange } from "@/server/content-translate"
import { AppError } from "@/server/errors"
import { CATEGORY_FIELDS, deeplProblem, setRetryBaseForTests, localizeFields, TESTIMONIAL_FIELDS, translateCategory, translateProduct, translateTestimonial } from "@/server/translate"

import { resetDb, seedProduct, testDb } from "./support/db"

beforeEach(async () => {
  await resetDb()
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.DEEPL_API_KEY
})

describe("Automatic product translation", () => {
  it("no key: nothing changes, the page shows the text as written", async () => {
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 1 }] })
    await testDb.update(products).set({ description: "Veste chaude" }).where(eq(products.id, tee.product.id))
    expect(await translateProduct(testDb, tee.product.id)).toBe("no-key")
    expect((await getProductPage(testDb, "tee", { locale: "ar" }))!.product.description).toBe("Veste chaude")
  })

  it("translates once into ar/fr/en, keeps the original language, and each visitor reads their language", async () => {
    process.env.DEEPL_API_KEY = "test:fx"
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { text: string[]; target_lang: string }
      calls.push(`${url.includes("api-free") ? "free" : "pro"}:${body.target_lang}`)
      return new Response(JSON.stringify({ translations: body.text.map((t) => ({ text: `[${body.target_lang}] ${t}`, detected_source_language: "FR" })) }))
    })
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 1 }] })
    await testDb.update(products).set({ description: "Veste chaude", care: "Lavage 30°" }).where(eq(products.id, tee.product.id))
    expect(await translateProduct(testDb, tee.product.id)).toBe("translated")
    expect(calls).toEqual(["free:AR", "free:FR", "free:EN-GB"])
    expect((await getProductPage(testDb, "tee", { locale: "ar" }))!.product.description).toBe("[AR] Veste chaude")
    expect((await getProductPage(testDb, "tee", { locale: "en" }))!.product.care).toBe("[EN-GB] Lavage 30°")
    // Written in French → the French page keeps the exact original words.
    expect((await getProductPage(testDb, "tee", { locale: "fr" }))!.product.description).toBe("Veste chaude")
    // Same texts again → no new calls.
    expect(await translateProduct(testDb, tee.product.id)).toBe("unchanged")
    expect(calls).toHaveLength(3)
  })
})

const fakeDeepl = (calls: string[] = []) =>
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { text: string[]; target_lang: string; source_lang?: string }
    calls.push(`${body.source_lang ?? "auto"}>${body.target_lang}:${body.text.join("|")}`)
    return new Response(JSON.stringify({ translations: body.text.map((t) => ({ text: `[${body.target_lang}] ${t}`, detected_source_language: "EN" })) }))
  })

describe("DeepL problems are explained to the admin", () => {
  it("too many requests (429): waits and retries instead of failing", async () => {
    process.env.DEEPL_API_KEY = "test:fx"
    setRetryBaseForTests(1)
    let calls = 0
    vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => {
      calls++
      if (calls % 2 === 1) return new Response("", { status: 429 })
      const body = JSON.parse(init.body) as { text: string[]; target_lang: string }
      return new Response(JSON.stringify({ translations: body.text.map((t) => ({ text: `[${body.target_lang}] ${t}`, detected_source_language: "EN" })) }))
    })
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 1 }] })
    await testDb.update(products).set({ description: "Warm jacket" }).where(eq(products.id, tee.product.id))
    expect(await translateProduct(testDb, tee.product.id)).toBe("translated")
    expect(calls).toBe(6)
  })

  it("still 429 after retries: a clear 'busy' message", async () => {
    process.env.DEEPL_API_KEY = "test:fx"
    setRetryBaseForTests(1)
    vi.stubGlobal("fetch", async () => new Response("", { status: 429 }))
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 1 }] })
    await testDb.update(products).set({ description: "Warm jacket" }).where(eq(products.id, tee.product.id))
    const err = await translateProduct(testDb, tee.product.id).catch((e) => e)
    expect(err.userMessage).toMatch(/busy/)
  })

  it("maps key, quota and busy errors to clear messages and stops on them", async () => {
    process.env.DEEPL_API_KEY = "test:fx"
    vi.stubGlobal("fetch", async () => new Response("Quota exceeded", { status: 456 }))
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 1 }] })
    await testDb.update(products).set({ description: "Warm jacket" }).where(eq(products.id, tee.product.id))
    const err = await translateProduct(testDb, tee.product.id).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe("TRANSLATION_FATAL")
    expect(err.userMessage).toMatch(/monthly limit/)
    expect(deeplProblem(403)).toMatch(/refused the key/)
    expect(deeplProblem(500)).toMatch(/500/)
  })

  it("network failure is reported, not a generic error", async () => {
    process.env.DEEPL_API_KEY = "test:fx"
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed")
    })
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 1 }] })
    await testDb.update(products).set({ description: "Warm jacket" }).where(eq(products.id, tee.product.id))
    const err = await translateProduct(testDb, tee.product.id).catch((e) => e)
    expect(err.userMessage).toMatch(/Could not reach DeepL/)
  })
})

describe("Categories and testimonials are translated too", () => {
  it("category name and tagline: stored per language and shown in the visitor's language", async () => {
    process.env.DEEPL_API_KEY = "test:fx"
    fakeDeepl()
    const [cat] = await testDb.insert(categories).values({ slug: "hoodies", name: "Hoodies", tagline: "Warm layers" }).returning()
    expect(await translateCategory(testDb, cat.id)).toBe("translated")
    const [row] = await testDb.select().from(categories).where(eq(categories.id, cat.id))
    expect(localizeFields(row, row.translations, "ar", CATEGORY_FIELDS).name).toBe("[AR] Hoodies")
    // Written in English → English keeps the exact words.
    expect(localizeFields(row, row.translations, "en", CATEGORY_FIELDS).tagline).toBe("Warm layers")
    expect(await translateCategory(testDb, cat.id)).toBe("unchanged")
  })

  it("testimonial words are translated, the person's name is not", async () => {
    process.env.DEEPL_API_KEY = "test:fx"
    fakeDeepl()
    const [t] = await testDb.insert(testimonials).values({ quote: "Best hoodie I own.", name: "Yacine", role: "Customer", published: true }).returning()
    expect(await translateTestimonial(testDb, t.id)).toBe("translated")
    const [row] = await testDb.select().from(testimonials).where(eq(testimonials.id, t.id))
    const fr = localizeFields(row, row.translations, "fr", TESTIMONIAL_FIELDS)
    expect(fr.quote).toBe("[FR] Best hoodie I own.")
    expect(fr.name).toBe("Yacine")
  })
})

describe("Page texts (Admin → Content)", () => {
  it("only the changed fields go to the two other languages; lines stay lines; images untouched", async () => {
    process.env.DEEPL_API_KEY = "test:fx"
    const calls: string[] = []
    fakeDeepl(calls)
    const before = (await getContent(testDb, "home.hero", "en")) as Record<string, string>
    const saved = { ...before, description: "New season, new rules.", headline: "Made\nfor\nAnnaba." }
    await saveContent(testDb, "home.hero", saved, "en")
    const n = await translateContentChange(testDb, "home.hero", "en", before, saved)
    expect(n).toBe(4) // 2 fields × 2 languages
    expect(calls.every((c) => c.startsWith("EN>"))).toBe(true)
    const ar = (await getContent(testDb, "home.hero", "ar")) as Record<string, string>
    expect(ar.description).toBe("[AR] New season, new rules.")
    expect(ar.headline).toBe("[AR] Made\n[AR] for\n[AR] Annaba.")
    expect(ar.slide1).toBe(before.slide1)
    // Unchanged fields keep the built-in translation.
    expect(ar.primaryCta).toBe(((await getContent(testDb, "home.hero", "ar")) as Record<string, string>).primaryCta)
    expect(calls.some((c) => c.includes(before.primaryCta))).toBe(false)
  })

  it("an edit in Arabic updates French and English", async () => {
    process.env.DEEPL_API_KEY = "test:fx"
    const calls: string[] = []
    fakeDeepl(calls)
    const before = (await getContent(testDb, "home.story", "ar")) as Record<string, string>
    const saved = { ...before, title: "من هو الملك؟" }
    await saveContent(testDb, "home.story", saved, "ar")
    await translateContentChange(testDb, "home.story", "ar", before, saved)
    expect(calls.map((c) => c.split(":")[0]).sort()).toEqual(["AR>EN-GB", "AR>FR"])
    expect(((await getContent(testDb, "home.story", "fr")) as Record<string, string>).title).toBe("[FR] من هو الملك؟")
  })
})

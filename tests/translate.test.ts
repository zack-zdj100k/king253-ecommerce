import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { products } from "@/server/db/schema"
import { getProductPage } from "@/server/catalog"
import { translateProduct } from "@/server/translate"

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

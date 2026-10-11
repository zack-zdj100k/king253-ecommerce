import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { contentBlocks, orderItems, productImages, productVariants, users } from "@/server/db/schema"
import { getVariantLine } from "@/server/cart"
import { categoryCrop, getContent, pairs, saveContent } from "@/server/content"
import { deleteMedia } from "@/server/media"
import { createOrder } from "@/server/orders/create"
import { addImages, saveColour, setImageColour } from "@/server/products-admin"
import { IMAGES } from "@/lib/site"
import { CATEGORY_CROPS } from "@/lib/products"

import { customer, key, resetDb, seedDelivery, seedProduct, testDb } from "./support/db"

let actor: { userId: string; label: string }

beforeEach(async () => {
  await resetDb()
  const [u] = await testDb.insert(users).values({ email: "admin@test.local", name: "Test admin", passwordHash: "x", role: "admin" }).returning()
  actor = { userId: u.id, label: "Test admin" }
})

async function twoColours() {
  const p = await seedProduct({
    slug: "tee",
    price: 3000,
    variants: [
      { size: "M", color: "Black", physical: 5 },
      { size: "L", color: "Black", physical: 5 },
      { size: "M", color: "Blue", physical: 5 },
    ],
  })
  // seedProduct adds one shared photo (/test.jpg); add one per colour.
  await addImages(testDb, p.product.id, ["/media/test/black.webp"], actor, "Black")
  await addImages(testDb, p.product.id, ["/media/test/blue.webp"], actor, "Blue")
  return p
}

describe("Colours", () => {
  it("each colour has its own price for every size", async () => {
    const p = await twoColours()
    await saveColour(testDb, p.product.id, "Blue", { name: "Blue", hex: "#1F4FA8", price: "3500" }, actor)
    const rows = await testDb.select().from(productVariants).where(eq(productVariants.productId, p.product.id))
    expect(rows.filter((v) => v.color === "Blue").map((v) => [v.priceOverride, v.colorHex])).toEqual([[3500, "#1f4fa8"]])
    expect(rows.filter((v) => v.color === "Black").every((v) => v.priceOverride === null)).toBe(true)
  })

  it("renaming a colour moves its sizes and photos together", async () => {
    const p = await twoColours()
    await saveColour(testDb, p.product.id, "Blue", { name: "Navy", hex: "", price: "" }, actor)
    const colours = (await testDb.select().from(productVariants).where(eq(productVariants.productId, p.product.id))).map((v) => v.color)
    expect(colours.sort()).toEqual(["Black", "Black", "Navy"])
    const photos = await testDb.select().from(productImages).where(eq(productImages.color, "Navy"))
    expect(photos.map((i) => i.url)).toEqual(["/media/test/blue.webp"])
  })

  it("cannot rename a colour onto an existing size + colour", async () => {
    const p = await twoColours()
    await expect(saveColour(testDb, p.product.id, "Blue", { name: "Black", hex: "", price: "" }, actor)).rejects.toThrow(/already exists/)
  })

  it("photos can only be assigned to colours the product has", async () => {
    const p = await twoColours()
    const [shared] = await testDb.select().from(productImages).where(eq(productImages.url, "/test.jpg"))
    await expect(setImageColour(testDb, p.product.id, shared.id, "Pink")).rejects.toThrow(/Add this colour first/)
    expect((await setImageColour(testDb, p.product.id, shared.id, "Blue")).color).toBe("Blue")
    expect((await setImageColour(testDb, p.product.id, shared.id, null)).color).toBeNull()
  })

  it("the bag and the order show the photo of the chosen colour", async () => {
    const p = await twoColours()
    const blue = p.variants.find((v) => v.color === "Blue")!
    const black = p.variants.find((v) => v.color === "Black")!
    expect((await getVariantLine(testDb, blue.id, 1))?.image?.url).toBe("/media/test/blue.webp")
    expect((await getVariantLine(testDb, black.id, 1))?.image?.url).toBe("/media/test/black.webp")

    const { wilaya } = await seedDelivery()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blue.id, quantity: 1 }], idempotencyKey: key() })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    expect(item.imageUrl).toBe("/media/test/blue.webp")
  })
})

describe("Website content (CMS)", () => {
  it("returns the approved copy until edited, and edits override it", async () => {
    expect((await getContent(testDb, "who.hero")).title).toBe("Who is King?")
    await saveContent(testDb, "who.hero", { title: "Who is the King?", subtitle: "", bogus: "x" })
    const hero = await getContent(testDb, "who.hero")
    expect(hero).toMatchObject({ title: "Who is the King?", subtitle: "More than a store. A streetwear identity.", image: IMAGES.portrait })
    const [row] = await testDb.select().from(contentBlocks).where(eq(contentBlocks.key, "who.hero"))
    expect(row.data).not.toHaveProperty("bogus")
  })

  it("category photos keep their tuned crop until replaced", async () => {
    const defaults = await getContent(testDb, "home.categories")
    expect(categoryCrop(defaults, "hoodies")).toEqual(CATEGORY_CROPS.hoodies)
    await saveContent(testDb, "home.categories", { image_hoodies: "/media/test/new.webp" })
    expect(categoryCrop(await getContent(testDb, "home.categories"), "hoodies")).toEqual({ url: "/media/test/new.webp", focusX: 50, focusY: 50, zoom: 1 })
  })

  it("parses feature rows", () => {
    expect(pairs("Visit | See it in person.\nSave favourites | Heart it")).toEqual([
      { title: "Visit", text: "See it in person." },
      { title: "Save favourites", text: "Heart it" },
    ])
  })
})

describe("Media library", () => {
  it("never deletes built-in images or files outside uploads", async () => {
    await expect(deleteMedia(testDb, IMAGES.studio02)).rejects.toThrow(/Only uploaded images/)
    await expect(deleteMedia(testDb, "/media/../../package.json")).rejects.toThrow(/Only uploaded images/)
  })

  it("refuses to delete an image still used by the website", async () => {
    await saveContent(testDb, "home.story", { image: "/media/2026/10/used.webp" })
    await expect(deleteMedia(testDb, "/media/2026/10/used.webp")).rejects.toThrow(/page content/)
    const p = await twoColours()
    expect(p).toBeTruthy()
    await expect(deleteMedia(testDb, "/media/test/blue.webp")).rejects.toThrow(/product photos/)
  })
})

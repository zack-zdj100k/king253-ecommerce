import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { categories, products } from "@/server/db/schema"
import { getCatalogFacets, getProductPage, listProducts } from "@/server/catalog"
import { deleteCategory, saveCategory } from "@/server/products-admin"

import { resetDb, seedProduct, testDb } from "./support/db"

const actor = { userId: null, label: "Test admin" }

beforeEach(async () => {
  await resetDb()
})

async function setup() {
  const pants = await saveCategory(testDb, null, { name: "Pants", parentId: null })
  const baggy = await saveCategory(testDb, null, { name: "Baggy jeans", parentId: pants.id })
  const classic = await saveCategory(testDb, null, { name: "Classic", parentId: pants.id })
  const a = await seedProduct({ slug: "baggy-1", price: 5000, variants: [{ size: "32", color: "Blue", physical: 2 }] })
  const b = await seedProduct({ slug: "classic-1", price: 5000, variants: [{ size: "32", color: "Black", physical: 2 }] })
  await testDb.update(products).set({ categoryId: baggy.id }).where(eq(products.id, a.product.id))
  await testDb.update(products).set({ categoryId: classic.id }).where(eq(products.id, b.product.id))
  return { pants, baggy, classic, a, b }
}

describe("Categories and subcategories", () => {
  it("a main category shows the products of its subcategories; a subcategory only its own", async () => {
    await setup()
    expect((await listProducts(testDb, { category: "pants" })).products.map((p) => p.slug).sort()).toEqual(["baggy-1", "classic-1"])
    expect((await listProducts(testDb, { category: "baggy-jeans" })).products.map((p) => p.slug)).toEqual(["baggy-1"])
  })

  it("facets list main categories and their subcategories separately", async () => {
    await setup()
    const f = await getCatalogFacets(testDb)
    expect(f.categories.map((c) => c.slug)).toContain("pants")
    expect(f.categories.map((c) => c.slug)).not.toContain("baggy-jeans")
    expect(f.subcategories).toEqual(expect.arrayContaining([expect.objectContaining({ slug: "baggy-jeans", parentSlug: "pants" })]))
  })

  it("the product page knows the main category (breadcrumb)", async () => {
    await setup()
    const page = await getProductPage(testDb, "baggy-1")
    expect(page?.category?.name).toBe("Baggy jeans")
    expect(page?.parentCategory?.name).toBe("Pants")
  })

  it("only two levels, and no category inside itself", async () => {
    const { pants, baggy } = await setup()
    await expect(saveCategory(testDb, null, { name: "Wide baggy", parentId: baggy.id })).rejects.toThrow(/already a subcategory/)
    await expect(saveCategory(testDb, pants.id, { name: "Pants", parentId: pants.id })).rejects.toThrow(/inside itself/)
    const other = await saveCategory(testDb, null, { name: "Bottoms", parentId: null })
    await expect(saveCategory(testDb, pants.id, { name: "Pants", parentId: other.id })).rejects.toThrow(/has subcategories/)
  })

  it("deleting never deletes products: they move up to the main category, subcategories become main", async () => {
    const { pants, baggy, a, b } = await setup()
    await deleteCategory(testDb, baggy.id, actor)
    expect((await testDb.select().from(products).where(eq(products.id, a.product.id)))[0].categoryId).toBe(pants.id)

    await deleteCategory(testDb, pants.id, actor)
    const [classic] = await testDb.select().from(categories).where(eq(categories.slug, "classic"))
    expect(classic.parentId).toBeNull()
    expect((await testDb.select().from(products).where(eq(products.id, b.product.id)))[0].categoryId).toBe(classic.id)
    expect((await testDb.select().from(products).where(eq(products.id, a.product.id)))[0].categoryId).toBeNull()
  })
})

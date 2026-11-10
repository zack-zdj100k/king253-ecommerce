import { inArray, sql } from "drizzle-orm"

import type { DbOrTx } from "../db/client"
import { productVariants, products } from "../db/schema"

/** What an admin needs to recognise a product line at a glance. */
export type LineInfo = {
  image: string | null
  category: string | null
  parentCategory: string | null
  colorHex: string | null
}

const EMPTY: LineInfo = { image: null, category: null, parentCategory: null, colorHex: null }

/**
 * Photo (the colour's own photo first, then the main one), category › subcategory
 * and colour swatch for order / return lines. Keyed by variant id, with a
 * product-id fallback for lines whose size was deleted from the catalog.
 */
export async function lineInfo(db: DbOrTx, refs: { variantId: string | null; productId?: string | null; color?: string }[]) {
  const variantIds = [...new Set(refs.map((r) => r.variantId).filter((v): v is string => !!v))]
  const productIds = [...new Set(refs.filter((r) => !r.variantId && r.productId).map((r) => r.productId as string))]
  const byVariant = new Map<string, LineInfo>()
  const byProduct = new Map<string, LineInfo>()

  if (variantIds.length) {
    const rows = await db
      .select({
        id: productVariants.id,
        colorHex: productVariants.colorHex,
        image: sql<string | null>`(select i.url from product_images i where i.product_id = ${productVariants.productId}
          order by (i.color = ${productVariants.color}) desc nulls last, i.is_main desc, i.sort_order limit 1)`,
        category: sql<string | null>`(select c.name from categories c join products p on p.category_id = c.id where p.id = ${productVariants.productId})`,
        parentCategory: sql<string | null>`(select pc.name from categories c join categories pc on pc.id = c.parent_id
          join products p on p.category_id = c.id where p.id = ${productVariants.productId})`,
      })
      .from(productVariants)
      .where(inArray(productVariants.id, variantIds))
    for (const r of rows) byVariant.set(r.id, { image: r.image, category: r.category, parentCategory: r.parentCategory, colorHex: r.colorHex })
  }
  if (productIds.length) {
    const rows = await db
      .select({
        id: products.id,
        image: sql<string | null>`(select i.url from product_images i where i.product_id = ${products.id} order by i.is_main desc, i.sort_order limit 1)`,
        category: sql<string | null>`(select c.name from categories c where c.id = ${products.categoryId})`,
        parentCategory: sql<string | null>`(select pc.name from categories c join categories pc on pc.id = c.parent_id where c.id = ${products.categoryId})`,
      })
      .from(products)
      .where(inArray(products.id, productIds))
    for (const r of rows) byProduct.set(r.id, { image: r.image, category: r.category, parentCategory: r.parentCategory, colorHex: null })
  }

  return (ref: { variantId: string | null; productId?: string | null }): LineInfo =>
    (ref.variantId && byVariant.get(ref.variantId)) || (ref.productId && byProduct.get(ref.productId)) || EMPTY
}

/** Categories for the "add item" filters: main categories with their subcategories. */
export async function categoriesForPicker(db: DbOrTx) {
  const rows = (await db.execute(sql`select id, name, parent_id as "parentId" from categories order by sort_order, name`)) as unknown as {
    id: number
    name: string
    parentId: number | null
  }[]
  return rows.map((r) => ({ id: Number(r.id), name: r.name, parentId: r.parentId === null ? null : Number(r.parentId) }))
}

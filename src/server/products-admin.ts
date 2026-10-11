import { and, asc, eq, inArray, ne, sql } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "./db/client"
import { categories, orderItems, productImages, productVariants, products, stockReservations } from "./db/schema"
import { audit, type Actor } from "./audit"
import { AppError, NotFoundError } from "./errors"
import { adjustPhysicalStock } from "./inventory"

/* ------------------------------------------------------------------ */
/* Products                                                           */
/* ------------------------------------------------------------------ */

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
/** "" / null → null (no price); numbers or numeric strings → whole dinars. Missing → unchanged. */
const money = z
  .preprocess(
    (v) => (v === "" || v === null ? null : typeof v === "string" ? Number(v) : v),
    z.number({ error: "Enter a price in dinars." }).int("Use whole dinars.").min(0, "Price cannot be negative.").nullable()
  )
  .optional()

export const productInput = z
  .object({
    name: z.string().trim().min(2, "Enter a product name.").max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(120)
      .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and dashes only.")
      .optional(),
    categoryId: z.coerce.number().int().positive().nullable().optional(),
    gender: z.enum(["men", "women", "unisex"]),
    status: z.enum(["draft", "published", "archived"]),
    price: money,
    salePrice: money,
    material: text(500),
    fit: text(200),
    style: text(200),
    collection: text(120),
    quality: text(1000),
    care: text(1000),
    shortDescription: text(300),
    description: text(5000),
    story: text(5000),
    inspiration: text(3000),
    brandNote: text(3000),
    tags: z
      .string()
      .optional()
      .transform((v) => [...new Set((v ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20)),
    videoUrl: z.union([z.literal(""), z.url("Enter a full video URL (https://…).")]).optional().transform((v) => v || null),
    featured: z.coerce.boolean(),
    seoTitle: text(70),
    seoDescription: text(170),
    ogImageUrl: text(500),
  })
  .refine((p) => p.salePrice == null || p.price == null || p.salePrice <= p.price, {
    message: "The sale price must be lower than the regular price.",
    path: ["salePrice"],
  })
  .refine((p) => p.status !== "published" || p.price != null, {
    message: "Set a price before publishing.",
    path: ["price"],
  })
export type ProductInput = z.input<typeof productInput>

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
}

async function uniqueSlug(db: Db, base: string, exceptId?: string) {
  const root = base || "product"
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`
    const [hit] = await db
      .select({ id: products.id })
      .from(products)
      .where(exceptId ? and(eq(products.slug, candidate), ne(products.id, exceptId)) : eq(products.slug, candidate))
    if (!hit) return candidate
  }
  throw new AppError("SLUG_TAKEN", "Could not find a free URL slug. Choose one manually.")
}

export async function saveProduct(db: Db, id: string | null, raw: ProductInput, actor: Actor) {
  const parsed = productInput.safeParse(raw)
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
  const input = parsed.data
  const slug = await uniqueSlug(db, input.slug || slugify(input.name), id ?? undefined)
  const values = { ...input, slug, categoryId: input.categoryId ?? null }

  if (id) {
    const [current] = await db.select().from(products).where(eq(products.id, id))
    if (!current) throw new NotFoundError("This product")
    const [updated] = await db
      .update(products)
      .set({ ...values, publishedAt: input.status === "published" && !current.publishedAt ? new Date() : current.publishedAt })
      .where(eq(products.id, id))
      .returning()
    await audit(db, actor, "product.update", "product", id, {
      before: { status: current.status, price: current.price, salePrice: current.salePrice, name: current.name },
      after: { status: updated.status, price: updated.price, salePrice: updated.salePrice, name: updated.name },
    })
    return updated
  }
  const [created] = await db
    .insert(products)
    .values({ ...values, publishedAt: input.status === "published" ? new Date() : null })
    .returning()
  await audit(db, actor, "product.create", "product", created.id, { name: created.name })
  return created
}

/* ------------------------------------------------------------------ */
/* Variants                                                           */
/* ------------------------------------------------------------------ */

export const variantInput = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "SKU is required.")
    .max(60)
    .regex(/^[A-Z0-9-_.]+$/, "SKU: letters, numbers, dashes, dots, underscores."),
  barcode: z
    .string()
    .trim()
    .max(64)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  size: z.string().trim().min(1, "Size is required.").max(20),
  color: z.string().trim().min(1, "Colour is required.").max(60),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Colour swatch must look like #1a1a1a.")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  priceOverride: money,
  salePriceOverride: money,
  lowStockThreshold: z
    .preprocess((v) => (v === "" || v === null ? null : typeof v === "string" ? Number(v) : v), z.number().int().min(0).max(1000).nullable())
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  active: z.coerce.boolean().default(true),
})
export type VariantInput = z.input<typeof variantInput>

function friendlyUnique(error: unknown): never {
  const e = error as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } }
  const pg = e?.cause?.code ? e.cause : e
  if (pg?.code === "23505") {
    if (pg.constraint_name === "product_variants_sku_unique") throw new AppError("SKU_TAKEN", "This SKU is already used by another variant.")
    if (pg.constraint_name === "product_variants_barcode_unique") throw new AppError("BARCODE_TAKEN", "This barcode is already used.")
    if (pg.constraint_name === "product_variants_option_unique") throw new AppError("OPTION_TAKEN", "This size + colour already exists for this product.")
  }
  throw error
}

/** Creates a variant. Opening stock is recorded through the stock ledger, never written silently. */
export async function createVariant(db: Db, productId: string, raw: VariantInput & { initialStock?: number }, actor: Actor) {
  const parsed = variantInput.safeParse(raw)
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the variant.")
  const initial = Number(raw.initialStock ?? 0)
  if (!Number.isInteger(initial) || initial < 0) throw new AppError("INVALID_STOCK", "Opening stock must be 0 or more.")
  try {
    return await db.transaction(async (tx) => {
      const [variant] = await tx.insert(productVariants).values({ ...parsed.data, productId }).returning()
      if (initial > 0 && actor.userId) {
        await adjustPhysicalStock(tx, { variantId: variant.id, newPhysical: initial, reason: "Opening stock", actorUserId: actor.userId })
      }
      await audit(tx, actor, "variant.create", "product", productId, { sku: variant.sku, initial })
      return variant
    })
  } catch (error) {
    friendlyUnique(error)
  }
}

export async function updateVariant(db: Db, variantId: string, raw: VariantInput, actor: Actor) {
  const parsed = variantInput.safeParse(raw)
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the variant.")
  try {
    const [before] = await db.select().from(productVariants).where(eq(productVariants.id, variantId))
    if (!before) throw new NotFoundError("This variant")
    // Size/colour of a variant that was already sold stays fixed — create a new variant instead.
    const [ordered] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.variantId, variantId)).limit(1)
    if ((before.size !== parsed.data.size || before.color !== parsed.data.color) && ordered) {
      throw new AppError("VARIANT_USED", "This variant has orders. Keep its size/colour and create a new variant instead.")
    }
    const [after] = await db.update(productVariants).set(parsed.data).where(eq(productVariants.id, variantId)).returning()
    await audit(db, actor, "variant.update", "product", before.productId, { sku: after.sku, active: after.active })
    return after
  } catch (error) {
    friendlyUnique(error)
  }
}

/** Units held for open orders or exchanges — these must be resolved before deleting. */
async function activeHolds(db: Db, variantIds: string[]) {
  if (!variantIds.length) return 0
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${stockReservations.quantity}), 0)::int` })
    .from(stockReservations)
    .where(and(inArray(stockReservations.variantId, variantIds), eq(stockReservations.status, "active")))
  return row.n
}

/**
 * Deletes a size/colour. Past orders keep their own copy of name, size,
 * colour and price, so history stays readable. Blocked while units are
 * reserved for an open order — cancel or deliver it first.
 */
export async function deleteVariant(db: Db, variantId: string, actor: Actor) {
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId))
  if (!variant) throw new NotFoundError("This variant")
  const held = await activeHolds(db, [variantId])
  if (held > 0) {
    throw new AppError("VARIANT_RESERVED", `${held} unit(s) of ${variant.sku} are reserved for open orders. Cancel or deliver those orders first.`)
  }
  await db.delete(productVariants).where(eq(productVariants.id, variantId))
  await audit(db, actor, "variant.delete", "product", variant.productId, { sku: variant.sku, physical: variant.physical })
  return variant
}

/** Deletes a product with its variants, images, reviews and wishlist entries. Returns image URLs to clean up. */
export async function deleteProduct(db: Db, productId: string, actor: Actor) {
  const [product] = await db.select().from(products).where(eq(products.id, productId))
  if (!product) throw new NotFoundError("This product")
  const variants = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, productId))
  const held = await activeHolds(db, variants.map((v) => v.id))
  if (held > 0) {
    throw new AppError("PRODUCT_RESERVED", `${held} unit(s) of this product are reserved for open orders. Cancel or deliver those orders first.`)
  }
  const images = await db.select({ url: productImages.url }).from(productImages).where(eq(productImages.productId, productId))
  await db.delete(products).where(eq(products.id, productId))
  await audit(db, actor, "product.delete", "product", productId, { name: product.name, slug: product.slug })
  return { product, imageUrls: images.map((i) => i.url) }
}

/** Suggested SKU, e.g. KING-HOOD-BLK-M-001 (admin can edit before saving). */
export function suggestSku(product: { slug: string; categorySlug?: string | null }, size: string, color: string, n: number) {
  const part = (s: string, len: number) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, len) || "X"
  return `KING-${part(product.categorySlug ?? product.slug, 4)}-${part(color, 3)}-${part(size, 4)}-${String(n).padStart(3, "0")}`
}

/* ------------------------------------------------------------------ */
/* Colours                                                            */
/* ------------------------------------------------------------------ */

const colourInput = z.object({
  name: z.string().trim().min(1, "Enter the colour name.").max(60),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Colour swatch must look like #1a1a1a.")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v.toLowerCase() : null)),
  /** One price for every size of this colour; empty = the product price. */
  price: money,
  /** Promo price for this colour; empty = no colour promo. */
  promo: money,
})
export type ColourInput = z.input<typeof colourInput>

/**
 * Renames / re-prices a colour: every size of that colour and its photos are
 * updated together. Past orders keep the colour name they were bought with.
 */
export async function saveColour(db: Db, productId: string, from: string, raw: ColourInput, actor: Actor) {
  const parsed = colourInput.safeParse(raw)
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the colour.")
  const { name, hex } = parsed.data
  const price = parsed.data.price ?? null
  const promo = parsed.data.promo ?? null
  const [product] = await db.select({ price: products.price }).from(products).where(eq(products.id, productId))
  if (!product) throw new NotFoundError("This product")
  const regular = price ?? product.price
  if (promo !== null && regular !== null && promo >= regular) {
    throw new AppError("PROMO_TOO_HIGH", `The promo price must be lower than the regular price (${regular} DA).`)
  }
  try {
    return await db.transaction(async (tx) => {
      const updated = await tx
        .update(productVariants)
        .set({ color: name, colorHex: hex, priceOverride: price, salePriceOverride: promo, updatedAt: new Date() })
        .where(and(eq(productVariants.productId, productId), eq(productVariants.color, from)))
        .returning({ id: productVariants.id })
      if (!updated.length) throw new NotFoundError("This colour")
      if (name !== from) {
        await tx.update(productImages).set({ color: name }).where(and(eq(productImages.productId, productId), eq(productImages.color, from)))
      }
      await audit(tx, actor, "product.colour.save", "product", productId, { from, name, hex, price, promo })
      return updated.length
    })
  } catch (error) {
    friendlyUnique(error)
  }
}

/** Assign a photo to one colour (or null = shown for every colour). */
export async function setImageColour(db: Db, productId: string, imageId: string, color: string | null) {
  const clean = color ? z.string().trim().min(1).max(60).parse(color) : null
  if (clean) {
    const [exists] = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), eq(productVariants.color, clean)))
      .limit(1)
    if (!exists) throw new AppError("UNKNOWN_COLOUR", "Add this colour first.")
  }
  const [img] = await db
    .update(productImages)
    .set({ color: clean })
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .returning()
  if (!img) throw new NotFoundError("This image")
  return img
}

/* ------------------------------------------------------------------ */
/* Images                                                             */
/* ------------------------------------------------------------------ */

export async function addImages(db: Db, productId: string, urls: string[], actor: Actor, color: string | null = null) {
  const existing = await db.select().from(productImages).where(eq(productImages.productId, productId))
  const start = existing.reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1
  const [product] = await db.select({ name: products.name }).from(products).where(eq(products.id, productId))
  if (!product) throw new NotFoundError("This product")
  const rows = await db
    .insert(productImages)
    .values(
      urls.map((url, i) => ({
        productId,
        url,
        color,
        alt: color ? `${product.name} — ${color}` : product.name,
        sortOrder: start + i,
        isMain: existing.length === 0 && i === 0,
      }))
    )
    .returning()
  await audit(db, actor, "product.images.add", "product", productId, { count: urls.length, color })
  return rows
}

export const imageInput = z.object({
  alt: z.string().trim().max(200).optional().transform((v) => v || null),
  focusX: z.coerce.number().min(0).max(100),
  focusY: z.coerce.number().min(0).max(100),
  zoom: z.coerce.number().min(1).max(5),
})

export async function updateImage(db: Db, imageId: string, raw: z.input<typeof imageInput>) {
  const data = imageInput.parse(raw)
  const [img] = await db.update(productImages).set(data).where(eq(productImages.id, imageId)).returning()
  if (!img) throw new NotFoundError("This image")
  return img
}

export async function setMainImage(db: Db, productId: string, imageId: string) {
  await db.transaction(async (tx) => {
    await tx.update(productImages).set({ isMain: false }).where(eq(productImages.productId, productId))
    await tx.update(productImages).set({ isMain: true }).where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
  })
}

export async function reorderImages(db: Db, productId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx.update(productImages).set({ sortOrder: i }).where(and(eq(productImages.id, id), eq(productImages.productId, productId)))
    }
  })
}

export async function deleteImage(db: Db, productId: string, imageId: string, actor: Actor) {
  const [img] = await db.delete(productImages).where(and(eq(productImages.id, imageId), eq(productImages.productId, productId))).returning()
  if (!img) throw new NotFoundError("This image")
  if (img.isMain) {
    const [next] = await db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.sortOrder)).limit(1)
    if (next) await db.update(productImages).set({ isMain: true }).where(eq(productImages.id, next.id))
  }
  await audit(db, actor, "product.images.delete", "product", productId, { url: img.url })
  return img
}

/* ------------------------------------------------------------------ */
/* Categories                                                         */
/* ------------------------------------------------------------------ */

const categoryInput = z.object({
  name: z.string().trim().min(2, "Enter a category name.").max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]*$/, "Slug: lowercase, numbers, dashes.").max(60).optional(),
  tagline: z.string().trim().max(60).optional().transform((v) => v || null),
  /** Main category for a subcategory (Pants › Baggy jeans); null = main category. */
  parentId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().positive().nullable()),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  active: z.coerce.boolean().default(true),
})
export type CategoryInput = z.input<typeof categoryInput>

export async function saveCategory(db: Db, id: number | null, raw: CategoryInput) {
  const parsed = categoryInput.safeParse(raw)
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the category.")
  const data = parsed.data
  const slug = data.slug || slugify(data.name)

  // Two levels only: a subcategory's parent must be a main category, and a
  // category that already has subcategories cannot itself become one.
  if (data.parentId !== null) {
    if (data.parentId === id) throw new AppError("INVALID_PARENT", "A category cannot be inside itself.")
    const [parent] = await db.select().from(categories).where(eq(categories.id, data.parentId))
    if (!parent) throw new AppError("INVALID_PARENT", "Choose an existing main category.")
    if (parent.parentId !== null) throw new AppError("INVALID_PARENT", `${parent.name} is already a subcategory — choose a main category.`)
    if (id) {
      const [child] = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).limit(1)
      if (child) throw new AppError("HAS_CHILDREN", "This category has subcategories, so it must stay a main category.")
    }
  }
  try {
    if (id) {
      const [row] = await db.update(categories).set({ ...data, slug }).where(eq(categories.id, id)).returning()
      if (!row) throw new NotFoundError("This category")
      return row
    }
    const [row] = await db.insert(categories).values({ ...data, slug }).returning()
    return row
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } }
    if ((e.cause?.code ?? e.code) === "23505") throw new AppError("SLUG_TAKEN", "A category with this slug already exists.")
    throw error
  }
}

/**
 * Deletes a category. Its products are kept: they move up to the main
 * category (for a subcategory) or become uncategorised. Subcategories of a
 * deleted main category become main categories.
 */
export async function deleteCategory(db: Db, id: number, actor: Actor) {
  return db.transaction(async (tx) => {
    const [category] = await tx.select().from(categories).where(eq(categories.id, id))
    if (!category) throw new NotFoundError("This category")
    const moved = await tx
      .update(products)
      .set({ categoryId: category.parentId })
      .where(eq(products.categoryId, id))
      .returning({ id: products.id })
    await tx.update(categories).set({ parentId: null }).where(eq(categories.parentId, id))
    await tx.delete(categories).where(eq(categories.id, id))
    await audit(tx, actor, "category.delete", "category", String(id), { name: category.name, productsMoved: moved.length })
    return { category, productsMoved: moved.length }
  })
}

export async function productIdsInCategory(db: Db, categoryId: number) {
  return db.select({ id: products.id }).from(products).where(inArray(products.categoryId, [categoryId]))
}

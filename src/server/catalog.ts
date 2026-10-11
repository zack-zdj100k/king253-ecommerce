import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { categories, productImages, productVariants, products, reviews } from "./db/schema"
import { availableOf } from "./inventory"
import { effectivePriceSql, offerOf } from "./pricing"
import { sortSizes } from "@/lib/sizes"

export type CardImage = { url: string; focusX: number; focusY: number; zoom: number; alt?: string | null }

export type ProductCardData = {
  id: string
  slug: string
  name: string
  categorySlug: string | null
  categoryName: string | null
  /** The product's price shown on cards (promo price when the product is on promo). */
  price: number | null
  /** Regular price, struck through, when the product is on promo. */
  compareAt: number | null
  /** True when the product or at least one colour is on promo. */
  promo: boolean
  image: CardImage | null
  colours: { name: string; hex: string | null }[]
  sizes: string[]
  available: number
  ratingAvg: number | null
  ratingCount: number
  featured: boolean
}

export const SORTS = ["featured", "newest", "price_asc", "price_desc", "popular", "rating"] as const
export type Sort = (typeof SORTS)[number]

export type CatalogFilters = {
  q?: string
  category?: string
  size?: string
  color?: string
  gender?: "men" | "women" | "unisex"
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sort?: Sort
  page?: number
  pageSize?: number
}

type Row = {
  id: string
  slug: string
  name: string
  price: number | null
  sale_price: number | null
  featured: boolean
  category_slug: string | null
  category_name: string | null
  available: number
  min_price: number | null
  card_price: number | null
  any_promo: boolean | null
  colours: { name: string; hex: string | null }[] | null
  sizes: string[] | null
  image: CardImage | null
  rating_avg: number | null
  rating_count: number
  total: number
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

function toCard(r: Row): ProductCardData {
  // Card = the product's own price and promo (Pricing panel in the admin).
  // Colour prices and promos show on the product page when a colour is picked.
  // Only a product without a price of its own falls back to the lowest colour price.
  const offer = r.price !== null ? offerOf({ price: r.price, salePrice: r.sale_price }, { priceOverride: null }) : { price: r.min_price, compareAt: null }
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    categorySlug: r.category_slug,
    categoryName: r.category_name,
    price: offer.price,
    compareAt: offer.compareAt,
    promo: offer.compareAt !== null || !!r.any_promo,
    image: r.image,
    colours: (r.colours ?? []).filter((c) => c.name),
    sizes: sortSizes(r.sizes ?? []),
    available: Number(r.available ?? 0),
    ratingAvg: r.rating_avg === null ? null : Math.round(Number(r.rating_avg) * 10) / 10,
    ratingCount: Number(r.rating_count ?? 0),
    featured: r.featured,
  }
}

const EFFECTIVE = effectivePriceSql("v", "p")
/** Card price in SQL (for sorting and price filters) — mirrors toCard(). */
const CARD_PRICE = sql`(case when p.price is not null then
    (case when p.sale_price is not null and p.sale_price < p.price then p.sale_price else p.price end)
  else agg.min_price end)`

/** Shared card query: one row per product with live availability, price, image, rating. */
async function cardQuery(db: DbOrTx, where: SQL[], orderBy: SQL, limit: number, offset = 0) {
  const rows = (await db.execute(sql`
    select p.id, p.slug, p.name, p.price, p.sale_price, p.featured,
      c.slug as category_slug, c.name as category_name,
      agg.available, agg.min_price, agg.colours, agg.sizes, agg.any_promo,
      ${CARD_PRICE} as card_price,
      img.image, r.avg as rating_avg, coalesce(r.cnt, 0) as rating_count,
      count(*) over() as total
    from products p
    left join categories c on c.id = p.category_id
    left join lateral (
      select coalesce(sum(greatest(v.physical - v.reserved, 0)), 0)::int as available,
        min(${EFFECTIVE})::int as min_price,
        bool_or(${EFFECTIVE} < coalesce(v.price_override, p.price)) as any_promo,
        jsonb_agg(distinct jsonb_build_object('name', v.color, 'hex', v.color_hex)) as colours,
        array_agg(distinct v.size) as sizes
      from product_variants v where v.product_id = p.id and v.active
    ) agg on true
    left join lateral (
      select json_build_object('url', i.url, 'focusX', i.focus_x, 'focusY', i.focus_y, 'zoom', i.zoom, 'alt', i.alt) as image
      from product_images i where i.product_id = p.id order by i.is_main desc, i.sort_order asc limit 1
    ) img on true
    left join lateral (
      select avg(rv.rating)::float as avg, count(*)::int as cnt
      from reviews rv where rv.product_id = p.id and rv.status = 'approved'
    ) r on true
    left join lateral (
      select coalesce(sum(oi.quantity), 0)::int as units from order_items oi
      join orders o on o.id = oi.order_id
      where oi.product_id = p.id and o.status <> 'cancelled' and oi.removed_at is null
    ) pop on true
    where ${sql.join(where, sql` and `)}
    order by ${orderBy}
    limit ${limit} offset ${offset}
  `)) as unknown as Row[]
  return { cards: rows.map(toCard), total: rows.length ? Number(rows[0].total) : 0 }
}

const ORDER: Record<Sort, SQL> = {
  featured: sql`p.featured desc, (agg.available > 0) desc, p.published_at desc nulls last, p.created_at desc`,
  newest: sql`p.published_at desc nulls last, p.created_at desc`,
  price_asc: sql`${CARD_PRICE} asc nulls last, p.created_at desc`,
  price_desc: sql`${CARD_PRICE} desc nulls last, p.created_at desc`,
  popular: sql`pop.units desc, p.created_at desc`,
  rating: sql`r.avg desc nulls last, r.cnt desc, p.created_at desc`,
}

export const PAGE_SIZE = 24

export async function listProducts(db: DbOrTx, f: CatalogFilters = {}) {
  const where: SQL[] = [sql`p.status = 'published'`]
  const q = f.q?.trim().slice(0, 80)
  if (q) {
    const pat = `%${escapeLike(q)}%`
    where.push(sql`(p.name ilike ${pat} or c.name ilike ${pat} or array_to_string(p.tags, ' ') ilike ${pat}
      or coalesce(p.style, '') ilike ${pat} or coalesce(p.collection, '') ilike ${pat} or coalesce(p.short_description, '') ilike ${pat})`)
  }
  // A main category also shows the products of its subcategories.
  if (f.category) where.push(sql`(c.slug = ${f.category} or c.parent_id = (select pc.id from categories pc where pc.slug = ${f.category}))`)
  if (f.gender) where.push(sql`p.gender in (${f.gender}, 'unisex')`)
  const stockClause = f.inStock ? sql`and v.physical - v.reserved > 0` : sql``
  if (f.size) where.push(sql`exists (select 1 from product_variants v where v.product_id = p.id and v.active and v.size = ${f.size} ${stockClause})`)
  if (f.color) where.push(sql`exists (select 1 from product_variants v where v.product_id = p.id and v.active and v.color = ${f.color} ${stockClause})`)
  if (f.inStock) where.push(sql`agg.available > 0`)
  if (f.minPrice !== undefined) where.push(sql`${CARD_PRICE} >= ${f.minPrice}`)
  if (f.maxPrice !== undefined) where.push(sql`${CARD_PRICE} <= ${f.maxPrice}`)

  const pageSize = Math.min(Math.max(f.pageSize ?? PAGE_SIZE, 1), 60)
  const page = Math.max(f.page ?? 1, 1)
  const { cards, total } = await cardQuery(db, where, ORDER[f.sort ?? "featured"], pageSize, (page - 1) * pageSize)
  return { products: cards, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getFeaturedProducts(db: DbOrTx, limit = 9) {
  const { cards } = await cardQuery(db, [sql`p.status = 'published'`], ORDER.featured, limit)
  return cards
}

export async function getCardsBySlugs(db: DbOrTx, slugs: string[]) {
  if (!slugs.length) return []
  const list = sql.join(slugs.slice(0, 50).map((s) => sql`${s}`), sql`, `)
  const { cards } = await cardQuery(db, [sql`p.status = 'published'`, sql`p.slug in (${list})`], ORDER.featured, 50)
  return slugs.flatMap((s) => cards.find((c) => c.slug === s) ?? [])
}

export async function getCardsByIds(db: DbOrTx, ids: string[]) {
  const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 50)
  if (!valid.length) return []
  const list = sql.join(valid.map((s) => sql`${s}::uuid`), sql`, `)
  const { cards } = await cardQuery(db, [sql`p.status = 'published'`, sql`p.id in (${list})`], ORDER.featured, 50)
  return valid.flatMap((id) => cards.find((c) => c.id === id) ?? [])
}

/** Related by category, tags, collection, style and gender — available pieces first. */
export async function getRelatedProducts(
  db: DbOrTx,
  p: { id: string; categoryId: number | null; tags: string[]; collection: string | null; style: string | null; gender: string },
  limit = 4
) {
  const tags = p.tags.length ? sql`array[${sql.join(p.tags.map((t) => sql`${t}`), sql`, `)}]::text[]` : sql`'{}'::text[]`
  const score = sql`(
    (p.category_id is not distinct from ${p.categoryId})::int * 3
    + (p.tags && ${tags})::int * 2
    + (p.collection is not null and p.collection = ${p.collection})::int * 2
    + (p.style is not null and p.style = ${p.style})::int
    + (p.gender::text = ${p.gender})::int)`
  const { cards } = await cardQuery(
    db,
    [sql`p.status = 'published'`, sql`p.id <> ${p.id}::uuid`],
    sql`(agg.available > 0) desc, ${score} desc, p.created_at desc`,
    limit
  )
  return cards
}

/* ------------------------------------------------------------------ */
/* Product page                                                       */
/* ------------------------------------------------------------------ */

export async function getProductPage(db: DbOrTx, slug: string, opts: { includeDrafts?: boolean } = {}) {
  const [product] = await db
    .select()
    .from(products)
    .where(opts.includeDrafts ? eq(products.slug, slug) : and(eq(products.slug, slug), eq(products.status, "published")))
  if (!product) return null

  const [category, images, variants, ratingRows] = await Promise.all([
    product.categoryId
      ? db.select().from(categories).where(eq(categories.id, product.categoryId)).then((r) => r[0] ?? null)
      : null,
    db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(desc(productImages.isMain), asc(productImages.sortOrder)),
    db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, product.id), eq(productVariants.active, true)))
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.color)),
    db
      .select({ rating: reviews.rating, count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(eq(reviews.productId, product.id), eq(reviews.status, "approved")))
      .groupBy(reviews.rating),
  ])

  const [parentCategory] = category?.parentId ? await db.select().from(categories).where(eq(categories.id, category.parentId)) : []
  const totalReviews = ratingRows.reduce((s, r) => s + r.count, 0)
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: ratingRows.find((r) => r.rating === stars)?.count ?? 0 }))
  const average = totalReviews ? Math.round((ratingRows.reduce((s, r) => s + r.rating * r.count, 0) / totalReviews) * 10) / 10 : null

  return {
    product,
    category,
    /** Main category when the product sits in a subcategory (Pants › Baggy jeans). */
    parentCategory: parentCategory ?? null,
    images,
    variants: variants.map((v) => {
      const offer = offerOf(product, v)
      return {
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        price: offer.price,
        /** Regular price when this colour is on promo. */
        compareAt: offer.compareAt,
        available: availableOf(v),
      }
    }),
    rating: { average, total: totalReviews, distribution },
  }
}
/** The product's written details as titled sections (empty ones left out). */
export function productDetails(product: typeof products.$inferSelect, brandName: string) {
  const join = (parts: (string | null | false)[], sep: string) => parts.filter(Boolean).join(sep) || null
  return [
    { title: "Description", body: product.description },
    { title: "Material & fabric", body: join([product.material, product.quality], "\n\n") },
    {
      title: "Fit & style",
      body: join([product.fit && `Fit: ${product.fit}`, product.style && `Style: ${product.style}`, product.collection && `Collection: ${product.collection}`], "\n"),
    },
    { title: "Care", body: product.care },
    { title: "The story", body: join([product.story, product.inspiration], "\n\n") },
    { title: brandName, body: product.brandNote },
  ].filter((d): d is { title: string; body: string } => !!d.body)
}

export type ProductPageData = NonNullable<Awaited<ReturnType<typeof getProductPage>>>

/* ------------------------------------------------------------------ */
/* Filters                                                            */
/* ------------------------------------------------------------------ */

export async function getCatalogFacets(db: DbOrTx) {
  const [cats, sizeRows, colourRows, [range]] = await Promise.all([
    db
      .select({
        slug: categories.slug,
        name: categories.name,
        tagline: categories.tagline,
        parentSlug: sql<string | null>`(select pc.slug from categories pc where pc.id = "categories"."parent_id")`,
      })
      .from(categories)
      .where(and(eq(categories.active, true), sql`(${categories.parentId} is null or exists (select 1 from categories pc where pc.id = ${categories.parentId} and pc.active))`))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.execute(sql`select distinct v.size from product_variants v join products p on p.id = v.product_id where p.status = 'published' and v.active`),
    db.execute(sql`select distinct on (v.color) v.color, v.color_hex from product_variants v join products p on p.id = v.product_id where p.status = 'published' and v.active order by v.color`),
    db.execute(sql`select min(${EFFECTIVE})::int as min, max(${EFFECTIVE})::int as max
      from product_variants v join products p on p.id = v.product_id where p.status = 'published' and v.active`),
  ])
  return {
    /** Main categories (tabs, tiles, menus). */
    categories: cats.filter((c) => !c.parentSlug),
    /** Subcategories, each pointing at its main category. */
    subcategories: cats.filter((c): c is typeof c & { parentSlug: string } => !!c.parentSlug),
    sizes: sortSizes((sizeRows as unknown as { size: string }[]).map((r) => r.size)),
    colours: (colourRows as unknown as { color: string; color_hex: string | null }[]).map((r) => ({ name: r.color, hex: r.color_hex })),
    priceRange: range as unknown as { min: number | null; max: number | null },
  }
}

import type { Metadata } from "next"

import { db } from "@/server/db"
import { getCardsBySlugs, getCatalogFacets, getFeaturedProducts, listProducts, SORTS, type CatalogFilters, type Sort } from "@/server/catalog"
import { categoryCrop, getContent, lines, pairs } from "@/server/content"
import { Catalog } from "@/components/shop/catalog"
import { FeaturedHero } from "@/components/shop/clothes/featured-hero"
import { CategoryTiles } from "@/components/shop/clothes/category-tiles"
import { AssembleLook } from "@/components/shop/clothes/assemble-look"
import { ClothesValues, JoinBand } from "@/components/shop/clothes/clothes-values"

export const metadata: Metadata = {
  title: "The Collection",
  description: "Streetwear for the modern King. T-shirts, hoodies, jackets, pants, denim and accessories.",
  alternates: { canonical: "/clothes" },
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const int = (v: string | undefined) => {
  const n = v ? Number.parseInt(v, 10) : Number.NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export default async function ClothesPage({ searchParams }: PageProps<"/clothes">) {
  const p = await searchParams
  const sort = one(p.sort)
  const gender = one(p.gender)
  const filters: CatalogFilters = {
    q: one(p.q)?.trim().slice(0, 80) || undefined,
    category: one(p.category)?.slice(0, 60) || undefined,
    size: one(p.size)?.slice(0, 20) || undefined,
    color: one(p.color)?.slice(0, 60) || undefined,
    gender: gender === "men" || gender === "women" || gender === "unisex" ? gender : undefined,
    minPrice: int(one(p.min)),
    maxPrice: int(one(p.max)),
    inStock: one(p.stock) === "1" || undefined,
    sort: SORTS.includes(sort as Sort) ? (sort as Sort) : undefined,
    page: int(one(p.page)) || 1,
  }

  const [result, facets, featured, look, basics, hero, join, categories] = await Promise.all([
    listProducts(db, filters),
    getCatalogFacets(db),
    getFeaturedProducts(db, 7),
    getContent(db, "clothes.look"),
    getContent(db, "clothes.basics"),
    getContent(db, "clothes.hero"),
    getContent(db, "clothes.join"),
    getContent(db, "home.categories"),
  ])
  const lookProducts = await getCardsBySlugs(db, [...new Set(lines(look.products))])

  return (
    <>
      <FeaturedHero products={featured} content={hero} />
      <CategoryTiles categories={facets.categories} crops={Object.fromEntries(facets.categories.map((c) => [c.slug, categoryCrop(categories, c.slug)]))} />
      <Catalog
        products={result.products}
        total={result.total}
        page={result.page}
        pages={result.pages}
        facets={facets}
        filters={filters}
      />
      <AssembleLook products={lookProducts} content={look} />
      <ClothesValues content={{ ...basics, features: pairs(basics.features) }} />
      <JoinBand content={join} />
    </>
  )
}

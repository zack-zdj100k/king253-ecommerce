import type { MetadataRoute } from "next"
import { desc, eq } from "drizzle-orm"

import { db } from "@/server/db"
import { products } from "@/server/db/schema"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")
  const items = await db
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(eq(products.status, "published"))
    .orderBy(desc(products.updatedAt))
  const pages = ["", "/clothes", "/who-is-king", "/location", "/track"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }))
  return [
    ...pages,
    ...items.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ]
}

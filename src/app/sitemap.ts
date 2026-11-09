import type { MetadataRoute } from "next"
import { desc, eq } from "drizzle-orm"

import { LOCALES, localePath } from "@/i18n/config"
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
  // One entry per page and language, each listing its other languages (hreflang).
  const entry = (path: string, extra: { priority: number; lastModified?: Date }) =>
    LOCALES.map((l) => ({
      url: `${base}${localePath(l, path || "/")}`,
      changeFrequency: "weekly" as const,
      ...extra,
      alternates: { languages: Object.fromEntries(LOCALES.map((x) => [x, `${base}${localePath(x, path || "/")}`])) },
    }))
  return [
    ...["", "/clothes", "/who-is-king", "/location", "/track"].flatMap((path) => entry(path, { priority: path === "" ? 1 : 0.7 })),
    ...items.flatMap((p) => entry(`/product/${p.slug}`, { priority: 0.8, lastModified: p.updatedAt })),
  ]
}

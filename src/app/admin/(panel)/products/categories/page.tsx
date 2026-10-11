import type { Metadata } from "next"
import { asc, sql } from "drizzle-orm"

import { db } from "@/server/db"
import { categories } from "@/server/db/schema"
import { PageHeader, Panel } from "@/components/admin/ui"
import { CategoriesEditor } from "@/components/admin/product/categories-editor"

export const metadata: Metadata = { title: "Categories" }

export default async function CategoriesPage() {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      tagline: categories.tagline,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
      active: categories.active,
      products: sql<number>`(select count(*)::int from products p where p.category_id = "categories"."id")`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Catalog" title="Categories">
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          Main categories (e.g. Pants) can have subcategories (Jeans, Baggy jeans, Classic…). In the shop, choosing Pants shows every pant;
          the subcategories appear as extra filters. Hidden categories disappear from the shop; their products stay. Deleting a category
          never deletes products.
        </p>
      </PageHeader>
      <Panel>
        <CategoriesEditor categories={rows} />
      </Panel>
    </div>
  )
}

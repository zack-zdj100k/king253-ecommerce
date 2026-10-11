import type { Metadata } from "next"
import { asc } from "drizzle-orm"

import { db } from "@/server/db"
import { categories } from "@/server/db/schema"
import { PageHeader } from "@/components/admin/ui"
import { ProductForm } from "@/components/admin/product/product-form"

export const metadata: Metadata = { title: "New product" }

export default async function NewProductPage() {
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder))
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Catalog" title="New product">
        <p className="mt-2 text-sm text-king-gray">Save first, then add sizes/colours, stock and photos.</p>
      </PageHeader>
      <ProductForm productId={null} categories={cats.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))} initial={null} />
    </div>
  )
}

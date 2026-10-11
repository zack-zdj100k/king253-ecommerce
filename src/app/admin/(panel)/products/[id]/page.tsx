import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { db } from "@/server/db"
import { getProductAdmin } from "@/server/admin/queries"
import { getSetting } from "@/server/settings"
import { deleteProductAction } from "@/app/admin/actions/products"
import { DeleteButton } from "@/components/admin/delete-button"
import { Badge, PageHeader, Panel } from "@/components/admin/ui"
import { ImagesManager } from "@/components/admin/product/images-manager"
import { ProductForm } from "@/components/admin/product/product-form"
import { VariantsEditor } from "@/components/admin/product/variants-editor"

export const metadata: Metadata = { title: "Edit product" }

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [data, threshold] = await Promise.all([getProductAdmin(db, id), getSetting(db, "lowStockThreshold")])
  if (!data) notFound()
  const { product, images, variants, categories } = data
  const categorySlug = categories.find((c) => c.id === product.categoryId)?.slug ?? null
  const colourNames = [...new Set(variants.map((v) => v.color))]
  const imgs = images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, color: i.color, isMain: i.isMain, focusX: i.focusX, focusY: i.focusY, zoom: i.zoom }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog · product"
        title={product.name}
        actions={<DeleteButton label="Delete product" confirm="Delete this product, its variants and images?" action={deleteProductAction.bind(null, product.id)} redirectTo="/admin/products" />}
      >
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge status={product.status}>{product.status}</Badge>
          {product.status === "published" && (
            <Link href={`/product/${product.slug}`} target="_blank" className="text-xs font-medium text-king-gray hover:text-king-white">View on site ↗</Link>
          )}
          <Link href="/admin/products" className="text-xs font-medium text-king-gray hover:text-king-white">← All products</Link>
        </div>
      </PageHeader>

      <Panel title="Colours, photos, prices & stock">
        <p className="mb-5 max-w-3xl text-sm text-king-gray">
          Every colour has its own photos, price and stock per size. Customers switch colours on the product page and see that colour&apos;s photos.
        </p>
        <VariantsEditor
          productId={product.id}
          product={{ slug: product.slug, categorySlug, pricing: { price: product.price, salePrice: product.salePrice } }}
          threshold={threshold}
          images={imgs}
          variants={variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            barcode: v.barcode,
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            priceOverride: v.priceOverride,
            salePriceOverride: v.salePriceOverride,
            lowStockThreshold: v.lowStockThreshold,
            sortOrder: v.sortOrder,
            active: v.active,
            physical: v.physical,
            reserved: v.reserved,
          }))}
        />
      </Panel>

      <Panel title="Photos for every colour">
        <p className="mb-4 text-sm text-king-gray">
          Shown whatever colour is picked (detail shots, lifestyle photos). The ★ photo is the one on product cards.
        </p>
        <ImagesManager productId={product.id} images={imgs.filter((i) => i.color === null || !colourNames.includes(i.color))} colours={colourNames} />
      </Panel>

      <ProductForm productId={product.id} categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))} initial={product} />
    </div>
  )
}

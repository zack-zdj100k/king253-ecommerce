import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { formatDA } from "@/lib/money"
import { db } from "@/server/db"
import { listProductsAdmin } from "@/server/admin/queries"
import { ProductImage } from "@/components/shop/product-image"
import { deleteProductAction } from "@/app/admin/actions/products"
import { DeleteButton } from "@/components/admin/delete-button"
import { Badge, Empty, LinkButton, PageHeader, Table, inputClass, selectClass, td, th, btnRed, pill } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Products" }

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const p = await searchParams
  const one = (v: unknown) => (typeof v === "string" ? v : undefined)
  const f = { q: one(p.q), status: one(p.status) ?? "all", page: Number(one(p.page)) || 1 }
  const { rows, total, page, pages } = await listProductsAdmin(db, f)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        actions={
          <>
            <LinkButton href="/admin/products/new" variant="red"><Plus className="size-3.5" aria-hidden /> New product</LinkButton>
            <LinkButton href="/admin/products/categories">Categories</LinkButton>
          </>
        }
      >
        <p className="mt-2 text-sm text-king-gray">{total} product(s). Only published products with a price appear in the shop.</p>
      </PageHeader>

      <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_auto]" action="/admin/products">
        <input name="q" defaultValue={f.q} placeholder="Search name or slug" aria-label="Search products" className={inputClass} />
        <select name="status" defaultValue={f.status} aria-label="Status" className={selectClass}>
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button type="submit" className={btnRed}>Filter</button>
      </form>

      {rows.length === 0 ? (
        <Empty>No products yet. Create the first one.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={th}>Status</th>
              <th className={th}>Price</th>
              <th className={th}>Variants</th>
              <th className={`${th} text-right`}>Physical / reserved / available</th>
              <th className={th}><span className="sr-only">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.02]">
                <td className={td}>
                  <Link href={`/admin/products/${r.id}`} className="flex items-center gap-3">
                    <span className="relative aspect-[4/5] w-10 shrink-0 overflow-hidden bg-king-card">
                      <ProductImage image={r.image} alt="" sizes="80px" />
                    </span>
                    <span>
                      <span className="block font-medium text-king-white hover:text-king-bright-red">{r.name}</span>
                      <span className="text-xs text-king-gray">/{r.slug}{r.featured ? " · featured" : ""}</span>
                    </span>
                  </Link>
                </td>
                <td className={td}>{r.category ?? "—"}</td>
                <td className={td}><Badge status={r.status}>{r.status}</Badge></td>
                <td className={td}>
                  {r.salePrice !== null ? (
                    <>
                      <span className="text-king-white">{formatDA(r.salePrice)}</span> <span className="text-xs line-through">{formatDA(r.price)}</span>
                    </>
                  ) : (
                    formatDA(r.price)
                  )}
                </td>
                <td className={td}>{r.stock.variants}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {r.stock.physical} / {r.stock.reserved} / <span className="text-king-white">{r.stock.physical - r.stock.reserved}</span>
                </td>
                <td className={`${td} w-px text-right`}>
                  <DeleteButton compact label={`Delete ${r.name}`} confirm="Delete product?" action={deleteProductAction.bind(null, r.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={`/admin/products?${new URLSearchParams({ ...(f.q ? { q: f.q } : {}), status: f.status, page: String(n) })}`} className={pill(n === page)}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

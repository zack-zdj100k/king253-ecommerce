import type { Metadata } from "next"
import Link from "next/link"

import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { db } from "@/server/db"
import { listCustomers } from "@/server/admin/queries"
import { deleteCustomerAction } from "@/app/admin/actions/site"
import { DeleteButton } from "@/components/admin/delete-button"
import { Empty, PageHeader, Table, inputClass, td, th, pill } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Customers" }

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const p = await searchParams
  const one = (v: unknown) => (typeof v === "string" ? v : undefined)
  const f = { q: one(p.q), page: Number(one(p.page)) || 1 }
  const { rows, total, page, pages } = await listCustomers(db, f)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Customers">
        <p className="mt-2 text-sm text-king-gray">{total} customer(s). Returning customers are recognised by phone number.</p>
      </PageHeader>
      <form action="/admin/customers" className="max-w-md">
        <input name="q" defaultValue={f.q} placeholder="Search name, phone or email" aria-label="Search customers" className={inputClass} />
      </form>
      {rows.length === 0 ? (
        <Empty>No customers yet — they appear with their first order.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Customer</th>
              <th className={th}>Wilaya</th>
              <th className={th}>Orders</th>
              <th className={th}>Delivered spend</th>
              <th className={th}>Last order</th>
              <th className={th}><span className="sr-only">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-white/[0.02]">
                <td className={td}>
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-king-white hover:text-king-bright-red">{c.fullName}</Link>
                  <span className="block text-xs">{formatPhone(c.phone)}{c.email ? ` · ${c.email}` : ""}</span>
                </td>
                <td className={td}>{c.wilaya ?? "—"}</td>
                <td className={td}>{c.stats.orders}{c.stats.orders > 1 ? <span className="ml-2 text-xs text-king-bright-red">returning</span> : null}</td>
                <td className={td}>{formatDA(c.stats.spent)}</td>
                <td className={td}>{c.stats.last ? new Date(c.stats.last).toLocaleDateString("en-GB") : "—"}</td>
                <td className={`${td} w-px text-right`}>
                  <DeleteButton compact label={`Delete ${c.fullName}`} confirm="Delete customer?" action={deleteCustomerAction.bind(null, c.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={`/admin/customers?page=${n}${f.q ? `&q=${encodeURIComponent(f.q)}` : ""}`} className={pill(n === page)}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

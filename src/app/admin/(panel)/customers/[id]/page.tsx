import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { MessageCircle, Phone } from "lucide-react"

import { formatDA } from "@/lib/money"
import { formatPhone, whatsappLink } from "@/lib/phone"
import { db } from "@/server/db"
import { getCustomerDetail } from "@/server/admin/queries"
import { STATUS_LABELS } from "@/server/orders/manage"
import { deleteCustomerAction } from "@/app/admin/actions/site"
import { DeleteButton } from "@/components/admin/delete-button"
import { Badge, PageHeader, Panel, Stat, Table, td, th, btnRed, btnOutline } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Customer" }

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const data = await getCustomerDetail(db, id)
  if (!data) notFound()
  const { customer: c, wilaya, orders, stats } = data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Customer since ${c.createdAt.toLocaleDateString("en-GB")}`}
        title={c.fullName}
        actions={<DeleteButton label="Delete customer" confirm="Delete? Their orders stay in Orders." action={deleteCustomerAction.bind(null, c.id)} redirectTo="/admin/customers" />}
      >
        <Link href="/admin/customers" className="mt-3 inline-block text-xs font-medium text-king-gray hover:text-king-white">← All customers</Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Contact">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs text-king-gray">Phone</dt><dd className="text-king-white">{formatPhone(c.phone)}</dd></div>
            {c.email && <div><dt className="text-xs text-king-gray">Email</dt><dd className="text-king-white">{c.email}</dd></div>}
            {c.age && <div><dt className="text-xs text-king-gray">Age</dt><dd className="text-king-white">{c.age}</dd></div>}
            <div><dt className="text-xs text-king-gray">Latest address</dt><dd className="text-king-muted">{[c.address, c.city, wilaya].filter(Boolean).join(", ") || "—"}</dd></div>
          </dl>
          <div className="mt-4 flex gap-2">
            <a href={`tel:${c.phone}`} className={btnRed}><Phone className="size-3.5" aria-hidden /> Call</a>
            <a href={whatsappLink(c.phone, `Bonjour ${c.fullName.split(" ")[0]}, ici KING 253.`)} target="_blank" rel="noreferrer" className={btnOutline}><MessageCircle className="size-3.5" aria-hidden /> WhatsApp</a>
          </div>
        </Panel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Orders" value={stats.total} hint={`${stats.open} open`} />
          <Stat label="Delivered" value={stats.delivered} hint={`${stats.cancelled} cancelled`} />
          <Stat label="Total spent" value={formatDA(stats.spent)} tone="red" hint="Delivered orders" />
          <Stat label="Avg order" value={formatDA(stats.average)} hint={stats.lastOrder ? `Last ${stats.lastOrder.toLocaleDateString("en-GB")}` : undefined} />
        </div>
      </div>

      <Panel title="Order history">
        <Table className="-m-5 w-[calc(100%+2.5rem)] max-w-none border-0 bg-transparent">
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Date</th>
              <th className={th}>Products</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-white/[0.02]">
                <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-medium text-king-white hover:text-king-bright-red">{o.number}</Link></td>
                <td className={td}>{o.createdAt.toLocaleDateString("en-GB")}</td>
                <td className={td}>{o.items.map((i) => `${i.name} (${i.color}/${i.size}) ×${i.quantity}`).join(", ")}</td>
                <td className={td}><Badge status={o.status}>{STATUS_LABELS[o.status]}</Badge></td>
                <td className={`${td} text-right text-king-white`}>{formatDA(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  )
}

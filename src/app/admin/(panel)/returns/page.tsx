import type { Metadata } from "next"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { db } from "@/server/db"
import { listReturnsAdmin } from "@/server/admin/queries"
import { ReturnActions } from "@/components/admin/moderation"
import { Badge, Empty, PageHeader, pill } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Returns & exchanges" }

export default async function ReturnsPage({ searchParams }: PageProps<"/admin/returns">) {
  const p = await searchParams
  const status = typeof p.status === "string" && ["open", "completed", "rejected", "all"].includes(p.status) ? p.status : "open"
  const rows = await listReturnsAdmin(db, status)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="After sales" title="Returns & exchanges">
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          Approve → (exchange: the new size is reserved) → Receive the item (resellable goes back to physical stock, damaged does not) → Complete (exchange: the replacement leaves stock; return: the refund is deducted from revenue).
        </p>
      </PageHeader>
      <div className="flex gap-2">
        {["open", "completed", "rejected", "all"].map((s) => (
          <Link key={s} href={`/admin/returns?status=${s}`} className={pill(status === s)}>
            {s}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>No {status} requests.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.request.id} className="grid gap-4 border border-white/10 bg-king-near-black p-5 lg:grid-cols-[1fr_auto]">
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium text-king-white">{r.request.type}</span>
                  <Badge status={r.request.status}>{r.request.status}</Badge>
                  <Link href={`/admin/orders/${r.orderId}`} className="text-king-white hover:text-king-bright-red">{r.orderNumber}</Link>
                  <span className="text-xs text-king-gray">{r.request.createdAt.toLocaleString("en-GB")}</span>
                </div>
                <p className="text-king-muted">
                  {r.customerName} · {formatPhone(r.customerPhone)}
                </p>
                <p className="text-king-white">
                  {r.item.name} — {r.item.color} / {r.item.size} × {r.request.quantity}
                  {r.replacement && (
                    <span className="text-king-muted">
                      {" "}→ {r.replacement.color} / {r.replacement.size} <span className="text-xs text-king-gray">({r.replacement.available} available)</span>
                    </span>
                  )}
                </p>
                <p className="text-king-muted">Reason: {r.request.reason}{r.request.details ? ` — ${r.request.details}` : ""}</p>
                {r.request.condition && <p className="text-xs text-king-gray">Received: {r.request.condition}</p>}
                {r.request.refundAmount ? <p className="text-xs text-king-bright-red">Refunded {formatDA(r.request.refundAmount)} — deducted from revenue</p> : null}
                {r.request.adminNote && <p className="text-xs text-king-gray">Note: {r.request.adminNote}</p>}
              </div>
              <div className="lg:w-80">
                <ReturnActions id={r.request.id} status={r.request.status} type={r.request.type} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

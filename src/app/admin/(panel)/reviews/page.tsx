import type { Metadata } from "next"
import Link from "next/link"
import { BadgeCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { db } from "@/server/db"
import { listReviewsAdmin } from "@/server/admin/queries"
import { ReviewActions } from "@/components/admin/moderation"
import { Badge, Empty, PageHeader, pill } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Reviews" }

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const p = await searchParams
  const status = typeof p.status === "string" && ["pending", "approved", "rejected", "all"].includes(p.status) ? p.status : "pending"
  const rows = await listReviewsAdmin(db, status)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Social proof" title="Reviews">
        <p className="mt-2 max-w-2xl text-sm text-king-gray">New reviews stay hidden until approved. &ldquo;Verified purchase&rdquo; is set automatically only when the order number + phone match a delivered order with this product.</p>
      </PageHeader>
      <div className="flex gap-2">
        {["pending", "approved", "rejected", "all"].map((s) => (
          <Link key={s} href={`/admin/reviews?status=${s}`} className={pill(status === s)}>
            {s}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>No {status === "all" ? "" : status} reviews.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ review: r, productName, productSlug }) => (
            <li key={r.id} className="border border-white/10 bg-king-near-black p-5">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-king-bright-red">{"★".repeat(r.rating)}<span className="text-white/20">{"★".repeat(5 - r.rating)}</span></span>
                <span className="font-semibold text-king-white uppercase">{r.authorName}</span>
                {r.verifiedPurchase && <span className="inline-flex items-center gap-1 text-xs font-medium text-king-bright-red"><BadgeCheck className="size-3.5" aria-hidden /> Verified purchase</span>}
                <Badge status={r.status}>{r.status}</Badge>
                <span className="text-xs text-king-gray">{r.createdAt.toLocaleString("en-GB")} · <Link href={`/product/${productSlug}`} target="_blank" className="hover:text-king-white">{productName}</Link></span>
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-king-muted">{r.body}</p>
              <div className="mt-4"><ReviewActions id={r.id} status={r.status} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

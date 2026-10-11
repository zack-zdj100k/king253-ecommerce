import type { Metadata } from "next"
import { asc, desc } from "drizzle-orm"

import { db } from "@/server/db"
import { testimonials } from "@/server/db/schema"
import { TestimonialForm } from "@/components/admin/moderation"
import { PageHeader, Panel } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Testimonials" }

export default async function TestimonialsPage() {
  const rows = await db.select().from(testimonials).orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt))
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Social proof" title="Testimonials">
        <p className="mt-2 max-w-2xl text-sm text-king-gray">
          Shown on Home and Who Is King only when published. Only add words real customers gave you (with their permission) — the section stays hidden while none are published.
        </p>
      </PageHeader>
      <Panel title="Add a testimonial">
        <TestimonialForm testimonial={null} />
      </Panel>
      {rows.length > 0 && (
        <Panel title={`${rows.length} testimonial(s)`}>
          <div className="space-y-3">
            {rows.map((t) => (
              <TestimonialForm key={t.id} testimonial={t} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

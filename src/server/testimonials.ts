import { asc, desc, eq } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { testimonials } from "./db/schema"

export async function publishedTestimonials(db: DbOrTx) {
  return db
    .select({ id: testimonials.id, quote: testimonials.quote, name: testimonials.name, role: testimonials.role, imageUrl: testimonials.imageUrl })
    .from(testimonials)
    .where(eq(testimonials.published, true))
    .orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt))
    .limit(30)
}

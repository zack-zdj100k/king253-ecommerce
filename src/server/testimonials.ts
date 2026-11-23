import { asc, desc, eq } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { testimonials } from "./db/schema"
import { requestLocale } from "./locale"
import { localizeFields, TESTIMONIAL_FIELDS } from "./translate"

/** Published testimonials, words in the visitor's language (automatic translation; as written otherwise). */
export async function publishedTestimonials(db: DbOrTx) {
  const [rows, locale] = await Promise.all([
    db
      .select({ id: testimonials.id, quote: testimonials.quote, name: testimonials.name, role: testimonials.role, imageUrl: testimonials.imageUrl, translations: testimonials.translations })
      .from(testimonials)
      .where(eq(testimonials.published, true))
      .orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt))
      .limit(30),
    requestLocale(),
  ])
  return rows.map(({ translations, ...t }) => localizeFields(t, translations, locale, TESTIMONIAL_FIELDS))
}

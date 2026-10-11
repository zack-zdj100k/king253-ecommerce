import { db } from "@/server/db"
import { getFeaturedProducts } from "@/server/catalog"
import { categoryCrop, getContent } from "@/server/content"
import { DEFAULT_CATEGORIES } from "@/lib/products"
import { publishedTestimonials } from "@/server/testimonials"
import { Hero } from "@/components/home/hero"
import { BrandStatement } from "@/components/home/brand-statement"
import { FeaturedCollection } from "@/components/home/featured-collection"
import { EditorialSection } from "@/components/home/editorial-section"
import { CategoryShowcase } from "@/components/home/category-showcase"
import { TestimonialsSection } from "@/components/home/testimonials-section"
import { StoryPreview } from "@/components/home/story-preview"
import { LocationPreview } from "@/components/home/location-preview"
import { FinalCTA } from "@/components/home/final-cta"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [hero, mindset, latestDrop, attitude, categories, story, shops, testimonialsHeader, finalCta, featured, testimonials] = await Promise.all([
    getContent(db, "home.hero"),
    getContent(db, "home.mindset"),
    getContent(db, "home.latestDrop"),
    getContent(db, "home.attitude"),
    getContent(db, "home.categories"),
    getContent(db, "home.story"),
    getContent(db, "home.location"),
    getContent(db, "home.testimonials"),
    getContent(db, "home.finalCta"),
    getFeaturedProducts(db, 9),
    publishedTestimonials(db),
  ])

  return (
    <>
      <Hero content={hero} />
      <BrandStatement content={mindset} />
      <FeaturedCollection products={featured} content={latestDrop} />
      <EditorialSection content={attitude} />
      <CategoryShowcase
        content={{
          eyebrow: categories.eyebrow,
          title: categories.title,
          crops: Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.slug, categoryCrop(categories, c.slug)])),
        }}
      />
      <TestimonialsSection testimonials={testimonials} content={testimonialsHeader} />
      <StoryPreview content={story} />
      <LocationPreview content={shops} />
      <FinalCTA content={finalCta} />
    </>
  )
}

import type { Metadata } from "next"
import { cache } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { db } from "@/server/db"
import { getProductPage, getRelatedProducts, productDetails } from "@/server/catalog"
import { offerOf } from "@/server/pricing"
import { approvedReviews } from "@/server/reviews"
import { getSettings } from "@/server/settings"
import { getCurrentUser } from "@/server/auth/session"
import { BackButton } from "@/components/ui/back-button"
import { BuyBox } from "@/components/product/buy-box"
import { ProductGallery } from "@/components/product/product-gallery"
import { RecentlyViewed } from "@/components/product/recently-viewed"
import { ReviewsSection, Stars } from "@/components/product/reviews"
import { ProductCard } from "@/components/shop/product-card"
import { ProductSelectionProvider } from "@/components/shop/variant-picker"

export const dynamic = "force-dynamic"

const load = cache((slug: string) => getProductPage(db, slug))
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const data = await load(slug)
  if (!data) return { title: "Not found" }
  const { product, images } = data
  const title = product.seoTitle || product.name
  const description = product.seoDescription || product.shortDescription || `${product.name} — KING 253 streetwear. Cash on delivery.`
  const image = product.ogImageUrl || images[0]?.url
  return {
    title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/product/${product.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function ProductPage({ params, searchParams }: PageProps<"/product/[slug]">) {
  const { slug } = await params
  const colourParam = (await searchParams).colour
  const initialColour = typeof colourParam === "string" ? colourParam.slice(0, 60) : null
  const data = await load(slug)
  if (!data) notFound()
  const { product, category, parentCategory, images, variants, rating } = data

  const [related, reviews, settings, user] = await Promise.all([
    getRelatedProducts(db, product),
    approvedReviews(db, product.id),
    getSettings(db),
    getCurrentUser(),
  ])

  const prices = variants.map((v) => v.price).filter((p): p is number => p !== null)
  const productOffer = offerOf(product, { priceOverride: null })
  const totalAvailable = variants.reduce((s, v) => s + v.available, 0)
  const crops = images.map((i) => ({
    url: i.url,
    focusX: i.focusX,
    focusY: i.focusY,
    zoom: i.zoom,
    alt: i.alt,
    color: i.color,
  }))
  // First photo of each colour, for the colour chips.
  const colourImages = Object.fromEntries([...new Set(variants.map((v) => v.color))].map((c) => [c, crops.find((i) => i.color === c) ?? null]))

  const details = productDetails(product, settings.brandName)

  // Product structured data — only facts that exist in the database.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seoDescription || product.shortDescription || product.description || undefined,
    image: images.map((i) => (i.url.startsWith("http") ? i.url : `${siteUrl()}${i.url}`)),
    sku: variants[0]?.sku,
    brand: { "@type": "Brand", name: settings.brandName },
    category: category?.name,
    offers: prices.length
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "DZD",
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: variants.length,
          availability: totalAvailable > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: `${siteUrl()}/product/${product.slug}`,
        }
      : undefined,
    aggregateRating:
      rating.total > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: rating.average,
            reviewCount: rating.total,
          }
        : undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="relative bg-king-black pt-24 pb-24 lg:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-[60svh] w-1/2 bg-[radial-gradient(ellipse_at_70%_20%,rgba(163,13,13,0.22),transparent_65%)]"
        />
        <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
          <BackButton fallback="/clothes" className="mb-2 -ml-0.5" />
          <nav aria-label="Breadcrumb" className="king-label mb-6 flex flex-wrap items-center gap-2 text-[0.55rem] text-king-gray">
            <Link href="/clothes" className="hover:text-king-white">
              Clothes
            </Link>
            {parentCategory && (
              <>
                <span aria-hidden>/</span>
                <Link href={`/clothes?category=${parentCategory.slug}#catalog`} className="hover:text-king-white">
                  {parentCategory.name}
                </Link>
              </>
            )}
            {category && (
              <>
                <span aria-hidden>/</span>
                <Link href={`/clothes?category=${category.slug}#catalog`} className="hover:text-king-white">
                  {category.name}
                </Link>
              </>
            )}
            <span aria-hidden>/</span>
            <span className="text-king-muted">{product.name}</span>
          </nav>

          <ProductSelectionProvider variants={variants} initialColour={initialColour}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
              <ProductGallery images={crops} name={product.name} />

              <div>
                {category && <p className="king-label text-[0.6rem] text-king-bright-red">{category.name}</p>}
                <h1 className="king-display mt-4 text-[clamp(2.5rem,4.5vw,4.75rem)] text-king-white">{product.name}</h1>
                {rating.total > 0 && (
                  <a href="#reviews-title" className="mt-4 inline-flex items-center gap-2 text-xs text-king-gray hover:text-king-white">
                    <Stars value={rating.average ?? 0} /> {rating.average?.toFixed(1)} · {rating.total} {rating.total === 1 ? "review" : "reviews"}
                  </a>
                )}
                {product.shortDescription && <p className="mt-5 max-w-md text-base leading-relaxed text-king-muted">{product.shortDescription}</p>}

                <div className="mt-8">
                  <BuyBox
                    product={{
                      id: product.id,
                      slug: product.slug,
                      name: product.name,
                      price: productOffer.price,
                      compareAt: productOffer.compareAt,
                    }}
                    variants={variants}
                    colourImages={colourImages}
                    signedIn={!!user}
                  />
                </div>

                {details.length > 0 && (
                  <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
                    {details.map((d, i) => (
                      <details key={d.title} open={i === 0} className="group py-4">
                        <summary className="king-label flex cursor-pointer list-none items-center justify-between text-[0.65rem] text-king-white">
                          {d.title}
                          <span aria-hidden className="text-king-bright-red transition-transform group-open:rotate-45">
                            +
                          </span>
                        </summary>
                        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-king-muted">{d.body}</p>
                      </details>
                    ))}
                  </div>
                )}

                {product.tags.length > 0 && (
                  <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tags">
                    {product.tags.map((t) => (
                      <li key={t}>
                        <Link
                          href={`/clothes?q=${encodeURIComponent(t)}#catalog`}
                          className="king-label inline-flex h-8 items-center border border-white/10 px-3 text-[0.55rem] text-king-gray hover:text-king-white"
                        >
                          {t}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </ProductSelectionProvider>

          <div className="mt-24 space-y-24">
            <ReviewsSection productId={product.id} rating={rating} reviews={reviews} />

            {related.length > 0 && (
              <section aria-labelledby="related-title" className="border-t border-white/10 pt-16">
                <h2 id="related-title" className="king-display text-[clamp(2rem,3.5vw,3.25rem)] text-king-white">
                  Wear it with
                </h2>
                <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 lg:grid-cols-4">
                  {related.map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} sizes={[50, 50, 25]} />
                  ))}
                </div>
              </section>
            )}

            <RecentlyViewed exclude={product.slug} />
          </div>
        </div>
      </div>
    </>
  )
}

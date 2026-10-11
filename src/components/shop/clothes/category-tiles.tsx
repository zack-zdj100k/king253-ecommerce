"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { CATEGORY_CROPS as DEFAULT_CROPS } from "@/lib/products"
import { ProductImage, productSizes, type Crop } from "@/components/shop/product-image"
import { TiltCard, TiltLayer } from "@/components/ui/3d-card"

const FALLBACK_CROP = DEFAULT_CROPS.jackets

/** Home Club–style category tiles: image, two-line label, arrow rule. */
export function CategoryTiles({
  categories,
  crops: CATEGORY_CROPS = DEFAULT_CROPS,
}: {
  categories: { slug: string; name: string; tagline: string | null }[]
  /** Category photos chosen in the CMS (Home → Categories). */
  crops?: Record<string, Crop>
}) {
  if (!categories.length) return null
  return (
    <section aria-label="Shop by category" className="relative bg-king-black py-10 md:py-14">
      <ul className="mx-auto grid max-w-[1600px] grid-cols-2 gap-3 px-4 sm:px-6 md:grid-cols-3 md:gap-4 lg:grid-cols-6 lg:px-12">
        {categories.map((c) => (
          <li key={c.slug} data-reveal>
            <TiltCard max={9} className="aspect-[16/11]">
              <Link
                href={`/clothes?category=${c.slug}#catalog`}
                className="king-chamfer group absolute inset-0 block overflow-hidden bg-king-surface-light [--cut:10px]"
              >
                <ProductImage
                  image={CATEGORY_CROPS[c.slug] ?? FALLBACK_CROP}
                  alt=""
                  sizes={productSizes(CATEGORY_CROPS[c.slug] ?? FALLBACK_CROP, [50, 34, 17])}
                  className="opacity-75 transition-[opacity,filter] duration-500 group-hover:opacity-100 group-hover:brightness-110"
                />
                <span className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-transparent" />
              </Link>
              <TiltLayer depth={45} className="pointer-events-none absolute inset-0 flex flex-col justify-end p-3 md:p-4">
                <span className="text-[0.8rem] leading-none font-semibold tracking-tight text-king-white uppercase md:text-sm">
                  {c.name}
                </span>
                <span className="king-label mt-1.5 text-[0.55rem] text-king-muted">{c.tagline}</span>
                <span className="mt-3 flex items-center gap-1 text-king-white" aria-hidden>
                  <span className="h-px w-6 bg-king-bright-red" />
                  <ArrowRight className="size-3" />
                </span>
              </TiltLayer>
            </TiltCard>
          </li>
        ))}
      </ul>
    </section>
  )
}

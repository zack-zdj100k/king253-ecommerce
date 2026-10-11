import Link from "next/link"
import { ArrowRight } from "lucide-react"

import type { ProductCardData } from "@/server/catalog"
import { Eyebrow } from "@/components/layout/editorial"
import { LatestDropFan } from "@/components/home/latest-drop-fan"

export function FeaturedCollection({
  products,
  content,
}: {
  products: ProductCardData[]
  content: { eyebrow: string; title: string; subtitle: string; link: string; empty: string }
}) {
  return (
    <section id="latest-drop" aria-labelledby="latest-title" className="relative overflow-hidden bg-king-near-black py-24 md:py-36">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div data-reveal>
              <Eyebrow>{content.eyebrow}</Eyebrow>
            </div>
            <h2 id="latest-title" data-reveal className="king-display mt-6 text-[clamp(2.75rem,7vw,7rem)] text-king-white">
              {content.title}
            </h2>
            <p data-reveal className="king-serif mt-3 text-[clamp(1.5rem,2.4vw,2.25rem)] text-king-muted">
              {content.subtitle}
            </p>
          </div>
          <Link
            data-reveal
            href="/clothes"
            className="king-label group inline-flex items-center gap-3 self-start text-king-white md:self-auto"
          >
            <span className="relative after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-right after:scale-x-0 after:bg-king-bright-red after:transition-transform after:duration-500 group-hover:after:origin-left group-hover:after:scale-x-100">
              {content.link}
            </span>
            <ArrowRight className="size-4 transition-transform duration-500 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="mt-6 px-4 md:mt-10">
        {products.length ? (
          <LatestDropFan products={products} />
        ) : (
          <p className="king-serif mx-auto max-w-[1600px] px-4 text-2xl text-king-muted sm:px-6 lg:px-12">{content.empty}</p>
        )}
      </div>
    </section>
  )
}

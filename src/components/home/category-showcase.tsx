"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { DEFAULT_CATEGORIES as CATEGORIES } from "@/lib/products"
import type { Crop } from "@/components/shop/product-image"
import { Eyebrow } from "@/components/layout/editorial"
import { ProductImage, productSizes } from "@/components/shop/product-image"


export function CategoryShowcase({ content }: { content: { eyebrow: string; title: string; crops: Record<string, Crop> } }) {
  const CATEGORY_CROPS = content.crops
  const mobileList = React.useRef<HTMLUListElement>(null)
  const [mobileActive, setMobileActive] = React.useState<string | null>(null)

  // Phones/tablets: the block crossing the middle of the screen becomes "active".
  React.useEffect(() => {
    const list = mobileList.current
    if (!list) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setMobileActive((e.target as HTMLElement).dataset.slug ?? null)
      },
      { rootMargin: "-45% 0px -45% 0px" }
    )
    list.querySelectorAll("li[data-slug]").forEach((li) => observer.observe(li))
    return () => observer.disconnect()
  }, [])
  const [active, setActive] = React.useState<string>(CATEGORIES[0].slug)

  return (
    <section id="categories" aria-labelledby="shop-style-title" className="relative overflow-hidden border-t border-white/[0.06] bg-king-near-black py-24 md:py-36">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div data-reveal>
          <Eyebrow>{content.eyebrow}</Eyebrow>
        </div>
        <h2 id="shop-style-title" data-reveal className="king-display mt-6 text-[clamp(2.75rem,7vw,7rem)] text-king-white">
          {content.title}
        </h2>

        {/* Desktop: typographic rows + lit preview */}
        <div className="mt-16 hidden gap-16 lg:grid lg:grid-cols-[1.5fr_1fr]">
          <ul>
            {CATEGORIES.map((c, i) => {
              const isActive = c.slug === active
              return (
                <li key={c.slug} data-reveal className="border-b border-white/10 first:border-t">
                  <Link
                    href={`/clothes?category=${c.slug}`}
                    onMouseEnter={() => setActive(c.slug)}
                    onFocus={() => setActive(c.slug)}
                    className="group flex items-center gap-8 py-5"
                  >
                    <span className={cn("king-label w-8 text-[0.625rem] transition-colors duration-500", isActive ? "text-king-bright-red" : "text-king-gray")}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "king-display flex-1 text-[clamp(3rem,5.6vw,6rem)] transition-[color,transform] duration-500 ease-king",
                        isActive ? "translate-x-3 text-king-white" : "text-white/25"
                      )}
                    >
                      {c.name}
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className={cn(
                        "size-8 transition-all duration-500 ease-king",
                        isActive ? "translate-x-0 text-king-bright-red opacity-100" : "-translate-x-3 text-king-gray opacity-0"
                      )}
                    />
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="relative">
            <div className="sticky top-28">
              <div aria-hidden className="absolute -inset-10 king-glow [--glow:rgb(163_13_13_/_0.30)]" />
              <div className="relative aspect-[4/5] overflow-hidden bg-king-card">
                {CATEGORIES.map((c) => (
                  <div
                    key={c.slug}
                    aria-hidden={c.slug !== active}
                    className={cn(
                      "absolute inset-0 transition-[opacity,transform] duration-700 ease-king",
                      c.slug === active ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
                    )}
                  >
                    <ProductImage
                      image={CATEGORY_CROPS[c.slug]}
                      alt={`${c.name} from the KING 253 campaign`}
                      sizes={productSizes(CATEGORY_CROPS[c.slug], [100, 100, 36])}
                    />
                  </div>
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-king-deep-red/50 via-transparent to-transparent mix-blend-multiply" />
                <div className="absolute inset-0 shadow-[inset_0_0_120px_20px_rgba(0,0,0,0.7)]" />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / tablet: stacked blocks. The block in the middle of the screen
            lights up like the desktop hover state. */}
        <ul ref={mobileList} className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
          {CATEGORIES.map((c, i) => {
            const on = mobileActive === c.slug
            return (
              <li key={c.slug} data-reveal data-slug={c.slug}>
                <div className="relative aspect-[16/10]">
                  <Link href={`/clothes?category=${c.slug}`} className="group absolute inset-0 block overflow-hidden bg-king-card">
                    <span
                      className={cn(
                        "absolute inset-0 transition-[opacity,transform] duration-700 ease-king",
                        on ? "scale-[1.06] opacity-100" : "scale-100 opacity-60"
                      )}
                    >
                      <ProductImage image={CATEGORY_CROPS[c.slug]} alt="" sizes={productSizes(CATEGORY_CROPS[c.slug], [100, 50, 50])} />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-king-deep-red/20" />
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 h-1 origin-left bg-king-bright-red transition-transform duration-700 ease-king",
                        on ? "scale-x-100" : "scale-x-0"
                      )}
                    />
                    <div className="absolute inset-0 flex items-end justify-between p-5">
                      <div>
                        <span className={cn("king-label text-[0.6rem] transition-colors duration-500", on ? "text-king-bright-red" : "text-king-gray")}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <p
                          className={cn(
                            "king-display mt-2 text-4xl transition-[color,transform] duration-500 ease-king",
                            on ? "translate-x-2 text-king-white" : "text-white/70"
                          )}
                        >
                          {c.name}
                        </p>
                      </div>
                      <ArrowUpRight
                        aria-hidden
                        className={cn(
                          "size-7 transition-all duration-500 ease-king",
                          on ? "translate-x-0 -translate-y-1 text-king-bright-red" : "-translate-x-2 text-king-white/60"
                        )}
                      />
                    </div>
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

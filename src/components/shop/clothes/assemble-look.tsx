"use client"

import * as React from "react"
import Image from "next/image"
import { Plus } from "lucide-react"

import { formatDA } from "@/lib/money"
import type { ProductCardData } from "@/server/catalog"
import { useShop } from "@/components/providers/shop-provider"
import { ProductImage, productSizes } from "@/components/shop/product-image"
import { TiltCard, TiltLayer } from "@/components/ui/3d-card"

/** Pieces chosen in the CMS ("clothes.look"). Each one needs its own size, so each opens its size picker. */
type LookContent = { eyebrow: string; title: string; note: string; hint: string; background: string }

export function AssembleLook({ products, content }: { products: ProductCardData[]; content: LookContent }) {
  const title = content.title.split("\n").map((l) => l.trim()).filter(Boolean)
  const { setQuickView } = useShop()
  if (products.length < 2) return null
  const priced = products.every((p) => p.price !== null)
  const total = priced ? products.reduce((sum, p) => sum + (p.price ?? 0), 0) : null

  return (
    <section id="look" aria-labelledby="look-title" className="bg-king-black py-16 md:py-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div className="king-chamfer grid overflow-hidden border border-white/10 [--cut:22px] lg:grid-cols-[minmax(0,0.75fr)_minmax(0,2.25fr)]">
          <div data-reveal className="flex flex-col justify-center bg-king-surface p-8 md:p-10">
            <p className="king-label text-[0.6rem] text-king-bright-red">{content.eyebrow}</p>
            <h2 id="look-title" className="king-display mt-4 text-[clamp(2.5rem,4.5vw,4.5rem)] text-king-white">
              {title.map((line, i) => (
                <span key={`${line}-${i}`} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="king-label mt-4 text-[0.6rem] leading-relaxed text-king-muted">{content.note}</p>
            <p className="mt-8 text-sm text-king-gray">{content.hint}</p>
            <p className="king-label mt-3 text-[0.6rem] text-king-white">Look total — {formatDA(total)}</p>
          </div>

          <div className="relative isolate p-6 md:p-10">
            <div className="absolute inset-0 -z-10">
              <Image src={content.background} alt="" fill sizes="70vw" className="object-cover object-[64%_50%] opacity-25 blur-[2px]" />
              <div className="absolute inset-0 bg-gradient-to-r from-king-black/80 via-king-black/60 to-king-black/80" />
            </div>
            <ol className="grid h-full grid-cols-2 items-center gap-5 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:gap-3">
              {products.slice(0, 4).map((p, i) => (
                <React.Fragment key={p.id}>
                  {i > 0 && (
                    <li aria-hidden className="hidden place-items-center text-king-bright-red md:grid">
                      <Plus className="size-5" />
                    </li>
                  )}
                  <li data-reveal>
                    <TiltCard max={12} className="aspect-[4/5]">
                      <button
                        type="button"
                        onClick={() => setQuickView(p.slug)}
                        aria-label={`Choose a size: ${p.name}`}
                        className="king-chamfer group absolute inset-0 overflow-hidden bg-king-surface-light"
                      >
                        <ProductImage image={p.image} alt="" sizes={productSizes(p.image, [50, 22, 14])} className="transition-[filter] duration-500 group-hover:brightness-110" />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </button>
                      <TiltLayer depth={40} className="pointer-events-none absolute right-3 bottom-3 left-3">
                        <span className="king-label text-[0.55rem] text-king-bright-red">{String(i + 1).padStart(2, "0")}</span>
                      </TiltLayer>
                    </TiltCard>
                    <p className="mt-3 text-[0.75rem] font-semibold tracking-tight text-king-white uppercase">{p.name}</p>
                    <p className="king-label mt-1 text-[0.55rem] text-king-gray">
                      {p.available > 0 ? formatDA(p.price) : "Out of stock"}
                    </p>
                  </li>
                </React.Fragment>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}

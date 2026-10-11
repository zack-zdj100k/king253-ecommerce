"use client"

import * as React from "react"
import Image from "next/image"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { IMAGES } from "@/lib/site"
import { formatDA } from "@/lib/money"
import type { ProductCardData } from "@/server/catalog"
import { useShop } from "@/components/providers/shop-provider"
import { OctagonButton } from "@/components/shop/octagon-button"
import { ProductImage, productSizes } from "@/components/shop/product-image"
import { TiltCard } from "@/components/ui/3d-card"

const pad = (n: number) => String(n).padStart(2, "0")

const FALLBACK = { url: IMAGES.studio02, focusX: 50, focusY: 50, zoom: 1 }

export type ClothesHeroContent = { eyebrow: string; title: string; subtitle: string; background: string }

export function FeaturedHero({ products: FEATURED, content }: { products: ProductCardData[]; content: ClothesHeroContent }) {
  const { setQuickView } = useShop()
  const [index, setIndex] = React.useState(0)
  const title = content.title.split("\n").map((l) => l.trim()).filter(Boolean)
  if (!FEATURED.length) return <EmptyHero content={content} />
  const product = FEATURED[Math.min(index, FEATURED.length - 1)]
  const image = product.image ?? FALLBACK
  const go = (step: number) => setIndex((i) => (i + step + FEATURED.length) % FEATURED.length)
  // Next pieces only — never the current one, never twice (matters with 1–2 featured products).
  const upcoming = [1, 2]
    .filter((n) => n < FEATURED.length)
    .map((n) => ({ product: FEATURED[(index + n) % FEATURED.length], i: (index + n) % FEATURED.length }))
  const portrait = image.url === IMAGES.portrait

  return (
    <MotionConfig reducedMotion="user">
      <section id="collection" aria-labelledby="collection-title" className="king-grain relative isolate overflow-hidden bg-king-black pt-24 pb-14 lg:pt-28 lg:pb-20">
        {/* Fence texture + red studio light */}
        <div className="absolute inset-0 -z-10">
          <Image src={content.background} alt="" fill preload sizes="100vw" className="object-cover opacity-35" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_55%_45%,rgba(163,13,13,0.35)_0%,rgba(5,5,5,0.85)_55%,#050505_100%)]" />
        </div>
        {/* Oversized outlined wordmark behind the model */}
        <p
          aria-hidden
          className="king-display pointer-events-none absolute top-[18%] left-1/2 -z-10 -translate-x-1/2 text-[clamp(7rem,24vw,26rem)] whitespace-nowrap text-transparent select-none [-webkit-text-stroke:1px_rgba(255,255,255,0.08)]"
        >
          King 253
        </p>

        <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-10 px-4 sm:px-6 lg:min-h-[calc(100svh-12rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.5fr)] lg:items-center lg:gap-12 lg:px-12">
          {/* Left — title, spec rows, add to bag */}
          <div className="order-1">
            <p className="king-label text-[0.6rem] whitespace-pre-wrap text-king-gray">{content.eyebrow}</p>
            <h1 id="collection-title" className="king-display mt-6 text-[clamp(3.25rem,7vw,7.5rem)] text-king-white">
              {title.map((line, i) => (
                <span key={`${line}-${i}`} className="block">
                  {line}
                  {i === title.length - 1 && !/[.?!]$/.test(line) ? <span className="text-king-bright-red">.</span> : null}
                </span>
              ))}
            </h1>
            <p className="king-serif mt-3 text-[clamp(1.4rem,2.2vw,2rem)] text-king-muted">{content.subtitle}</p>

            <dl className="mt-10 grid max-w-sm grid-cols-[6rem_1fr] gap-x-4 gap-y-3 border-t border-white/10 pt-6">
              <dt className="king-label text-[0.6rem] text-king-gray">Piece</dt>
              <dd className="text-sm font-medium text-king-white uppercase">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={product.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="block">
                    {product.name}
                  </motion.span>
                </AnimatePresence>
              </dd>
              <dt className="king-label text-[0.6rem] text-king-gray">Category</dt>
              <dd className="king-label text-[0.6rem] text-king-white">{product.categoryName}</dd>
              <dt className="king-label text-[0.6rem] text-king-gray">Colour</dt>
              <dd className="king-label flex items-center gap-2 text-[0.6rem] text-king-white">
                {product.colours[0] ? (
                  <span className="size-2.5 rounded-full ring-1 ring-white/30" style={{ backgroundColor: product.colours[0].hex ?? "#555" }} aria-hidden />
                ) : null}
                {product.colours.length > 1 ? `${product.colours.length} colours` : (product.colours[0]?.name ?? "—")}
              </dd>
            </dl>

            <OctagonButton
              className="mt-10"
              label={product.available > 0 ? "Choose size" : "Out of stock"}
              detail={`${formatDA(product.price)}${product.promo ? " · Promo" : ""}`}
              onClick={() => setQuickView(product.slug)}
            />
          </div>

          {/* Centre — the look */}
          <div className="relative order-2 mx-auto w-full max-w-md lg:max-w-none">
            <div aria-hidden className="absolute inset-x-[10%] bottom-0 h-1/3 king-glow [--glow:rgb(163_13_13_/_0.35)]" />
            <div className="king-chamfer relative aspect-[4/5] overflow-hidden bg-king-near-black [--cut:22px] lg:max-h-[74svh] lg:w-full">
              <AnimatePresence initial={false}>
                <motion.div
                  key={product.id}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.06, x: 24 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.98, x: -24 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Image
                    src={image.url}
                    alt={`${product.name} — KING 253 campaign`}
                    fill
                    quality={90}
                    preload={index === 0}
                    sizes={portrait ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 1024px) 90vw, 224vw"}
                    className="object-cover"
                    style={{ objectPosition: `${image.focusX}% 50%` }}
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-king-black/80 via-transparent to-king-black/20" />
              <p className="king-label absolute bottom-4 left-5 text-[0.6rem] text-king-muted">Look {pad(index + 1)}</p>
            </div>
          </div>

          {/* Right — next looks + counter */}
          <div className="order-3 flex flex-col gap-5">
            <div className="hidden gap-4 lg:grid">
              {upcoming.map(({ product: p, i }) => (
                <TiltCard key={p.id} max={8}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show ${p.name}`}
                    className="king-chamfer group relative block aspect-[4/5] w-full overflow-hidden bg-king-surface-light"
                  >
                    <ProductImage image={p.image} alt="" sizes={productSizes(p.image, [30, 30, 12])} className="transition-[filter] duration-500 group-hover:brightness-110" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="king-label absolute bottom-3 left-3 text-[0.55rem] text-king-white">{pad(i + 1)}</span>
                  </button>
                </TiltCard>
              ))}
            </div>

            {/* Mobile: all looks in a strip */}
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
              {FEATURED.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${p.name}`}
                  aria-current={i === index}
                  className={cn(
                    "king-chamfer relative aspect-[4/5] w-20 shrink-0 overflow-hidden bg-king-surface-light [--cut:8px]",
                    i === index ? "opacity-100 outline-2 outline-king-bright-red" : "opacity-55"
                  )}
                >
                  <ProductImage image={p.image} alt="" sizes={productSizes(p.image, [20, 12, 6])} />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button type="button" onClick={() => go(-1)} aria-label="Previous look" className="grid size-10 place-items-center rounded-full border border-white/15 text-king-muted transition-colors hover:border-king-bright-red hover:text-king-white">
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <span className="king-label text-[0.6rem] text-king-white tabular-nums">{pad(index + 1)}</span>
              <span className="relative h-px flex-1 bg-white/15">
                <span className="absolute inset-y-0 left-0 bg-king-bright-red transition-[width] duration-500 ease-king" style={{ width: `${((index + 1) / FEATURED.length) * 100}%` }} />
              </span>
              <span className="king-label text-[0.6rem] text-king-gray tabular-nums">{pad(FEATURED.length)}</span>
              <button type="button" onClick={() => go(1)} aria-label="Next look" className="grid size-10 place-items-center rounded-full border border-white/15 text-king-muted transition-colors hover:border-king-bright-red hover:text-king-white">
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <span className="sr-only" aria-live="polite">{`Look ${index + 1} of ${FEATURED.length}: ${product.name}`}</span>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}

function EmptyHero({ content }: { content: ClothesHeroContent }) {
  return (
    <section id="collection" className="relative bg-king-black px-4 pt-32 pb-16 sm:px-6 lg:px-12">
      <div className="mx-auto max-w-[1600px]">
        <p className="king-label text-[0.6rem] text-king-gray">[ KING 253 collection ]</p>
        <h1 id="collection-title" className="king-display mt-6 text-[clamp(3.25rem,7vw,7.5rem)] text-king-white">
          {content.title.replace(/\n/g, " ")}
          <span className="text-king-bright-red">.</span>
        </h1>
        <p className="king-serif mt-3 text-[clamp(1.4rem,2.2vw,2rem)] text-king-muted">The first drop is on its way.</p>
      </div>
    </section>
  )
}

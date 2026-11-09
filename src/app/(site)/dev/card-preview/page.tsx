import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { db } from "@/server/db"
import { getCurrentUser } from "@/server/auth/session"
import { listProducts } from "@/server/catalog"
import { productShopStock } from "@/server/inventory"
import { EditorialCard, GlassCard, HangTagCard, type CardProduct } from "@/components/shop/card-variants"

export const metadata: Metadata = { title: "Card preview", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

const VARIANTS = [
  { key: "glass", title: "01 · Glass overlay", note: "Closest to the glass reference: frosted panel with name, price tag and Add to cart." },
  { key: "editorial", title: "02 · Minimal editorial", note: "Photo only; name and price appear on hover or keyboard focus (always visible on phones)." },
  { key: "hangtag", title: "03 · Hang tag + shops", note: "From your reference image: paper price tag, stock per shop, colours, round + button." },
] as const

/** Owner-only preview of the three product-card directions, with real products. */
export default async function CardPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    const user = await getCurrentUser()
    if (user?.role !== "admin") notFound()
  }
  const { products: list } = await listProducts(db, { sort: "featured", pageSize: 4 })
  const products = list.slice(0, 4)
  const stock = await productShopStock(db, products.map((p) => p.id))
  const cards: CardProduct[] = products.map((p) => ({ ...p, shops: stock.get(p.id) ?? [] }))

  return (
    <section className="bg-king-black px-4 pt-28 pb-24 sm:px-6 lg:px-12">
      <p className="king-label text-[0.6rem] text-king-gray">[ Dev ] · Product card preview</p>
      <h1 className="king-display mt-3 text-[clamp(2.5rem,6vw,5rem)] text-king-white">Pick a card.</h1>
      <p className="mt-3 max-w-2xl text-sm text-king-gray">Same real products in each direction. Hover a card, tab through it with the keyboard, try the heart and the add button.</p>

      <div className="mt-14 space-y-20">
        {VARIANTS.map((v) => (
          <div key={v.key} id={v.key}>
            <h2 className="king-label text-king-white">{v.title}</h2>
            <p className="mt-2 text-sm text-king-gray">{v.note}</p>
            <ul className="mt-6 grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
              {cards.map((p, i) => (
                <li key={p.id}>
                  {v.key === "glass" ? <GlassCard product={p} /> : v.key === "editorial" ? <EditorialCard product={p} index={i} /> : <HangTagCard product={p} />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

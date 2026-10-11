import type { Metadata } from "next"

import { WishlistView } from "@/components/shop/wishlist-view"
import { BackButton } from "@/components/ui/back-button"

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } }

export default function WishlistPage() {
  return (
    <section className="relative min-h-[80svh] bg-king-black pt-28 pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <BackButton fallback="/clothes" className="mb-4" />
        <p className="king-label text-[0.6rem] text-king-gray">[ Saved pieces ]</p>
        <h1 className="king-display mt-4 mb-14 text-[clamp(2.75rem,7vw,6rem)] text-king-white">Wishlist.</h1>
        <WishlistView />
      </div>
    </section>
  )
}

import type { Metadata } from "next"
import { connection } from "next/server"

import { shopClosure } from "@/lib/closure"
import { db } from "@/server/db"
import { getSettings } from "@/server/settings"
import { ClosedPage } from "@/components/layout/closed-page"
import { ShopProvider } from "@/components/providers/shop-provider"
import { SmoothScroll } from "@/components/motion/smooth-scroll"
import { ScrollAnimations } from "@/components/motion/scroll-animations"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/ui/large-name-footer"
import { CartSheet } from "@/components/shop/cart-sheet"
import { QuickViewDialog } from "@/components/shop/quick-view-dialog"
import { ShopToast } from "@/components/shop/shop-toast"

/** Checked on every request so a closure starts and ends on time (never baked into a cached page). */
async function currentClosure() {
  await connection()
  const settings = await getSettings(db)
  return { settings, closure: shopClosure(settings) }
}

export async function generateMetadata(): Promise<Metadata> {
  const { closure } = await currentClosure()
  return closure.state === "closed" ? { title: "Back soon", robots: { index: false, follow: false } } : {}
}

/**
 * Storefront chrome: navbar, footer, bag, smooth scrolling. The admin has its own layout.
 * Vacation mode: while the shop is closed every storefront page shows the closed page instead.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { settings, closure } = await currentClosure()
  if (closure.state === "closed") return <ClosedPage settings={settings} until={closure.until} />
  return (
    <>
      <ShopProvider>
        <a
          href="#main"
          className="king-label sr-only z-[60] bg-king-red px-4 py-3 text-king-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
        <CartSheet />
        <QuickViewDialog />
        <ShopToast />
      </ShopProvider>
      <SmoothScroll />
      <ScrollAnimations />
    </>
  )
}

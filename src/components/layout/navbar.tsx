"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, ShoppingBag, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { gsap, MOTION_OK } from "@/lib/gsap"
import { NAV_LINKS, isActivePath } from "@/lib/site"
import { useShop } from "@/components/providers/shop-provider"
import { Logo } from "@/components/layout/logo"
import { MobileMenu } from "@/components/layout/mobile-menu"
import { SearchDialog } from "@/components/shop/search-dialog"

export function Navbar() {
  const pathname = usePathname()
  const { cart, setCartOpen } = useShop()
  const cartCount = cart.count
  const [scrolled, setScrolled] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const ref = React.useRef<HTMLElement>(null)

  const [hidden, setHidden] = React.useState(false)

  // Collapse once scrolled; slide away while scrolling down, return on any scroll up.
  React.useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastY
      setScrolled(y > 24)
      if (y < 120) setHidden(false)
      else if (delta > 6) setHidden(true)
      else if (delta < -6) setHidden(false)
      if (Math.abs(delta) > 6) lastY = y
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Let sticky UI (e.g. the catalog filter bar) slide up into the freed space.
  React.useEffect(() => {
    document.documentElement.toggleAttribute("data-nav-hidden", hidden)
  }, [hidden])

  // Fade down once, on first load.
  React.useEffect(() => {
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      gsap.fromTo(ref.current, { autoAlpha: 0, y: -24 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: "power3.out", delay: 0.1 })
    })
    return () => mm.revert()
  }, [])

  return (
    <>
      <header
        ref={ref}
        data-nav-reveal
        // No bar, no border: the brand and controls float over the page.
        // The header ignores clicks so content beneath it stays clickable.
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
      >
        <nav
          aria-label="Main"
          // Keyboard users tabbing into a hidden header bring it back.
          onFocusCapture={() => setHidden(false)}
          className={cn(
            "mx-auto grid h-16 max-w-[1600px] grid-cols-[1fr_auto] items-center px-4 drop-shadow-[0_1px_10px_rgba(0,0,0,0.65)] transition-[translate,opacity] duration-500 ease-king sm:px-6 lg:h-[72px] lg:grid-cols-[1fr_auto_1fr] lg:px-12",
            hidden && "-translate-y-full opacity-0"
          )}
        >
          <Logo className="pointer-events-auto justify-self-start" />

          {/* Desktop links — fade away once the visitor scrolls */}
          <ul
            className={cn(
              "hidden items-center gap-10 transition-[opacity,visibility,translate] duration-500 ease-king lg:flex",
              scrolled ? "invisible -translate-y-2 opacity-0" : "pointer-events-auto"
            )}
          >
            {NAV_LINKS.map((link) => {
              const active = isActivePath(pathname, link.href)
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "king-label relative py-2 transition-colors duration-300",
                      "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-king-bright-red after:transition-transform after:duration-500 after:ease-king",
                      active
                        ? "text-king-white after:scale-x-100"
                        : "text-king-muted after:scale-x-0 hover:text-king-white hover:after:scale-x-100"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="pointer-events-auto flex items-center justify-end gap-1 justify-self-end sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={cn(
                "king-label hidden h-11 items-center gap-2 px-3 text-king-muted transition-[color,opacity] duration-500 hover:text-king-white",
                !scrolled && "lg:inline-flex"
              )}
            >
              <Search className="size-4" aria-hidden />
              Search
            </button>
            <Link
              href="/account"
              aria-label="Account"
              aria-current={pathname.startsWith("/account") || pathname === "/sign-in" || pathname === "/sign-up" ? "page" : undefined}
              className="grid size-11 place-items-center text-king-white/85 transition-colors hover:text-king-white aria-[current=page]:text-king-bright-red"
            >
              <User className="size-[1.1rem]" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Open bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              className="relative grid size-11 place-items-center text-king-white/85 transition-colors hover:text-king-white"
            >
              <ShoppingBag className="size-[1.1rem]" aria-hidden />
              {cartCount > 0 && (
                <span className="absolute top-1.5 right-1 grid min-w-4 place-items-center bg-king-bright-red px-1 text-[0.6rem] leading-4 font-semibold text-king-white tabular-nums">
                  {cartCount}
                </span>
              )}
            </button>
            <MobileMenu pathname={pathname} onSearch={() => setSearchOpen(true)} showOnDesktop={scrolled} />
          </div>
        </nav>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}

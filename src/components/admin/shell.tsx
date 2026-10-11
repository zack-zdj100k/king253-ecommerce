"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Boxes,
  ChevronRight,
  Crown,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquareQuote,
  MoreHorizontal,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tags,
  UserCog,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { signOutAction } from "@/app/actions/auth"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { BackButton } from "@/components/ui/back-button"

type Badges = { new_orders: number; pending_reviews: number; open_returns: number; low_stock: number; has_demo: boolean }

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "Sales", color: "#e8282e" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, badge: "new_orders", group: "Sales", color: "#ff9f0a" },
  { href: "/admin/returns", label: "Returns", icon: RotateCcw, badge: "open_returns", group: "Sales", color: "#ff375f" },
  { href: "/admin/abandoned", label: "Abandoned carts", icon: ShoppingCart, group: "Sales", color: "#bf5af2" },
  { href: "/admin/products", label: "Products", icon: Package, group: "Catalog", color: "#0a84ff" },
  { href: "/admin/products/categories", label: "Categories", icon: Tags, group: "Catalog", color: "#5e5ce6" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, badge: "low_stock", group: "Catalog", color: "#30b0c7" },
  { href: "/admin/customers", label: "Customers", icon: Users, group: "People", color: "#30d158" },
  { href: "/admin/users", label: "Users", icon: UserCog, group: "People", color: "#32ade6" },
  { href: "/admin/reviews", label: "Reviews", icon: Star, badge: "pending_reviews", group: "People", color: "#ffcc00" },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote, group: "People", color: "#ac8e68" },
  { href: "/admin/social", label: "Social media", icon: Megaphone, group: "People", color: "#ff2d55" },
  { href: "/admin/content", label: "Content", icon: FileText, group: "Site", color: "#8e8e93" },
  { href: "/admin/locations", label: "Locations", icon: MapPin, group: "Site", color: "#34c759" },
  { href: "/admin/settings", label: "Settings", icon: Settings, group: "Site", color: "#8e8e93" },
] as const
type NavItem = (typeof NAV)[number]
const GROUPS = ["Sales", "Catalog", "People", "Site"] as const

/** iPhone tab bar: the four daily screens + "More" (everything else, in a sheet). */
const TABS = [
  { href: "/admin", label: "Home", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, badge: "new_orders" },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory", label: "Stock", icon: Boxes, badge: "low_stock" },
] as const

/** The most specific match wins (Categories, not Products, on /admin/products/categories). */
function useActiveHref() {
  const pathname = usePathname()
  return NAV.map((i) => i.href as string)
    .filter((href) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0]
}

const countOf = (item: object, badges: Badges) => ("badge" in item ? Number(badges[item.badge as keyof Badges]) || 0 : 0)

/* iOS app-icon style square for each section. */
function AppIcon({ icon: Icon, color, active }: { icon: NavItem["icon"]; color: string; active?: boolean }) {
  return (
    <span
      className={cn("grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white transition-colors", active && "bg-white/20")}
      style={active ? undefined : { backgroundColor: color }}
    >
      <Icon className="size-[17px]" strokeWidth={2.2} aria-hidden />
    </span>
  )
}

/** iPadOS sidebar list: rounded rows, the selected one filled with the tint. */
function SidebarList({ badges }: { badges: Badges }) {
  const activeHref = useActiveHref()
  return (
    <div className="space-y-5 px-3">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="px-3 pb-1.5 text-[13px] font-semibold text-[var(--ios-label-2)]">{group}</p>
          <ul className="space-y-0.5">
            {NAV.filter((i) => i.group === group).map((item) => {
              const active = item.href === activeHref
              const count = countOf(item, badges)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-[12px] pr-3 pl-1.5 text-[15px] transition-colors duration-150",
                      active ? "bg-[color:var(--ios-tint)] font-semibold text-white" : "text-white/90 hover:bg-white/[0.06]"
                    )}
                  >
                    <AppIcon icon={item.icon} color={item.color} active={active} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {count > 0 && (
                      <span className={cn("grid h-[22px] min-w-[22px] place-items-center rounded-full px-1.5 text-[12px] font-semibold tabular-nums", active ? "bg-white text-[var(--ios-tint)]" : "bg-[color:var(--ios-tint)] text-white")}>
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** iOS Settings-style grouped list (used in the "More" sheet). */
function GroupedList({ badges, onNavigate }: { badges: Badges; onNavigate: () => void }) {
  const activeHref = useActiveHref()
  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="px-4 pb-1.5 text-[13px] font-semibold text-[var(--ios-label-2)] uppercase">{group}</p>
          <ul className="overflow-hidden rounded-[14px] bg-[color:var(--ios-cell)]">
            {NAV.filter((i) => i.group === group).map((item, i) => {
              const count = countOf(item, badges)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={item.href === activeHref ? "page" : undefined}
                    className="flex min-h-12 items-center gap-3 pl-3 transition-colors active:bg-white/[0.08]"
                  >
                    <AppIcon icon={item.icon} color={item.color} />
                    <span className={cn("flex flex-1 items-center gap-2 self-stretch py-3 pr-3 text-[16px] text-white", i > 0 && "border-t border-[var(--ios-sep)]")}>
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && <span className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[color:var(--ios-tint)] px-1.5 text-[12px] font-semibold text-white">{count}</span>}
                      {item.href === activeHref && <span className="text-[13px] text-[var(--ios-label-2)]">Open</span>}
                      <ChevronRight className="size-4 text-[var(--ios-label-3)]" aria-hidden />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-[10px] bg-[color:var(--ios-tint)] shadow-[0_6px_16px_-6px_rgba(232,40,46,0.8)]">
        <Crown className="size-5 -rotate-6 text-white" strokeWidth={2.2} aria-hidden />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold tracking-[-0.02em] text-white">KING 253</span>
        {!compact && <span className="mt-1 text-[12px] font-medium text-[var(--ios-label-2)]">Admin</span>}
      </span>
    </Link>
  )
}

function Account({ user }: { user: { name: string; email: string } }) {
  return (
    <div className="rounded-[16px] bg-[color:var(--ios-cell-2)] p-3">
      <div className="flex items-center gap-3">
        {/* Contacts-style monogram */}
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#a1a1a6] to-[#6e6e73] text-[16px] font-semibold text-white" aria-hidden>
          {user.name.trim().charAt(0).toUpperCase() || "A"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-white">{user.name}</span>
          <span className="block truncate text-[13px] text-[var(--ios-label-2)]">{user.email}</span>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[color:var(--ios-fill)] text-[13px] font-semibold text-white transition-transform active:scale-95">
          <ExternalLink className="size-3.5" aria-hidden /> View site
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-[color:var(--ios-fill)] text-[13px] font-semibold text-[#ff6961] transition-transform active:scale-95">
            <LogOut className="size-3.5" aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </div>
  )
}

/** iPhone tab bar — translucent material, fixed at the bottom. */
function TabBar({ badges, onMore, moreOpen }: { badges: Badges; onMore: () => void; moreOpen: boolean }) {
  const activeHref = useActiveHref()
  const inTabs = TABS.some((t) => t.href === activeHref)
  const item = "relative flex flex-1 flex-col items-center justify-center gap-1 pt-1.5 text-[10px] font-medium transition-colors"
  return (
    <nav
      aria-label="Admin tabs"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#161618]/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="mx-auto flex h-[58px] max-w-md">
        {TABS.map((t) => {
          const active = t.href === activeHref && !moreOpen
          const count = countOf(t, badges)
          const Icon = t.icon
          return (
            <li key={t.href} className="flex flex-1">
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cn(item, active ? "text-[var(--ios-tint)]" : "text-[#8e8e93]")}>
                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.3 : 1.8} aria-hidden />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-semibold text-white">{count}</span>
                  )}
                </span>
                {t.label}
              </Link>
            </li>
          )
        })}
        <li className="flex flex-1">
          <button type="button" onClick={onMore} aria-expanded={moreOpen} className={cn(item, moreOpen || !inTabs ? "text-[var(--ios-tint)]" : "text-[#8e8e93]")}>
            <MoreHorizontal className="size-6" strokeWidth={moreOpen || !inTabs ? 2.3 : 1.8} aria-hidden />
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}

type ClosureNotice = { state: "open" | "closed" | "scheduled"; from: string | null; until: string | null }

export function AdminShell({ user, badges, closure, children }: { user: { name: string; email: string }; badges: Badges; closure?: ClosureNotice; children: React.ReactNode }) {
  const [more, setMore] = React.useState(false)
  const pathname = usePathname()

  return (
    <div className="ios-admin min-h-svh bg-black text-white lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* iPad / desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh flex-col bg-[color:var(--ios-cell)] lg:flex">
        <div className="px-5 pt-6 pb-5">
          <Brand />
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto pb-4">
          <SidebarList badges={badges} />
        </nav>
        <div className="p-3">
          <Account user={user} />
        </div>
      </aside>

      <div className="min-w-0">
        {/* iPhone navigation bar (translucent material) */}
        <header className="sticky top-0 z-40 flex h-14 items-center border-b border-white/[0.08] bg-black/70 px-4 backdrop-blur-2xl backdrop-saturate-150 lg:hidden">
          <Brand compact />
        </header>

        {closure && closure.state !== "open" && (
          <Link
            href="/admin/settings#shop-status"
            className={cn(
              "mx-4 mt-4 flex items-center gap-3 rounded-[14px] px-4 py-3 text-[13px] transition-opacity hover:opacity-85 sm:mx-6 lg:mx-10",
              closure.state === "closed" ? "bg-[#ff453a]/15 text-[#ff8a84]" : "bg-[#ff9f0a]/15 text-[#ffc266]"
            )}
          >
            <span className={cn("size-2 shrink-0 animate-pulse rounded-full motion-reduce:animate-none", closure.state === "closed" ? "bg-[#ff453a]" : "bg-[#ff9f0a]")} aria-hidden />
            <span className="flex-1">
              {closure.state === "closed"
                ? `The shop is closed to visitors${closure.until ? ` — reopens ${closure.until}` : " until you reopen it"}.`
                : `Closure scheduled: ${closure.from}${closure.until ? ` → ${closure.until}` : ""}.`}
            </span>
            <span className="font-semibold">Manage</span>
          </Link>
        )}
        {badges.has_demo && (
          <p className="mx-4 mt-4 rounded-[14px] bg-[#ff9f0a]/15 px-4 py-3 text-[13px] text-[#ffc266] sm:mx-6 lg:mx-10">
            Demo products are loaded (SKUs starting with DEMO-). Ask your developer to remove them before going live.
          </p>
        )}
        <main className="mx-auto max-w-[1400px] px-4 pt-4 pb-28 sm:px-6 md:pt-8 lg:px-10 lg:pb-12">
          {pathname !== "/admin" && <BackButton variant="admin" fallback={pathname.replace(/\/[^/]+\/?$/, "") || "/admin"} className="mb-3 -ml-1" />}
          {children}
        </main>
      </div>

      <TabBar badges={badges} onMore={() => setMore(true)} moreOpen={more} />

      {/* iOS sheet with every section */}
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="ios-admin max-h-[88svh] gap-0 overflow-y-auto rounded-t-[22px] border-0 bg-black p-0 text-white" data-lenis-prevent>
          <div className="sticky top-0 z-10 bg-black/80 px-4 pt-2 pb-3 backdrop-blur-xl">
            <span className="mx-auto block h-[5px] w-9 rounded-full bg-white/25" aria-hidden />
            <SheetTitle className="mt-3 text-[22px] font-bold tracking-[-0.02em] text-white">All sections</SheetTitle>
            <SheetDescription className="sr-only">Every admin section</SheetDescription>
          </div>
          <div className="space-y-6 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            <GroupedList badges={badges} onNavigate={() => setMore(false)} />
            <Account user={user} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

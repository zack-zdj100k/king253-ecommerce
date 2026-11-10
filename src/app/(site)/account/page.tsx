import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Heart, LayoutDashboard, LogOut, MailPlus, MapPin, Package, Settings2, ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { signOutAction } from "@/app/actions/auth"
import { db } from "@/server/db"
import { accountOrders, getAccount } from "@/server/account"
import { getCurrentUser } from "@/server/auth/session"
import { CUSTOMER_STEPS } from "@/server/orders/view"
import { DeleteAccount, DetailsForm, PasswordForm, RemoveFromMyOrders } from "@/components/account/account-forms"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("account"))("metaTitle"), robots: { index: false } }
}
export const dynamic = "force-dynamic"

const TABS = [
  { key: "orders", icon: Package },
  { key: "info", icon: Settings2 },
  { key: "security", icon: ShieldCheck },
] as const
type Tab = (typeof TABS)[number]["key"]

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const t = await getTranslations("account")
  const session = await getCurrentUser()
  if (!session) redirect("/sign-in?next=/account")
  const requested = (await searchParams).tab
  const tab: Tab = TABS.some((t) => t.key === requested) ? (requested as Tab) : "orders"

  const [user, orders] = await Promise.all([getAccount(db, session.id), accountOrders(db, session.id)])
  const open = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length

  return (
    <section className="relative min-h-[80svh] bg-king-black pt-28 pb-24">
      <div aria-hidden className="pointer-events-none absolute top-0 left-0 h-[45svh] w-full bg-[radial-gradient(ellipse_at_20%_0%,rgba(163,13,13,0.2),transparent_60%)]" />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <BackButton fallback="/" className="mb-4" />
        {/* Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-5">
            <span className="king-display grid size-16 shrink-0 place-items-center rounded-full bg-king-red text-2xl text-king-white md:size-20 md:text-3xl" aria-hidden>
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="king-label text-[0.625rem] text-king-gray">{t("eyebrow")}</p>
              <h1 className="king-display mt-2 truncate text-[clamp(2.25rem,6vw,4.5rem)] text-king-white">{t("hi", { name: user.name.split(" ")[0] })}</h1>
              <p className="mt-1 truncate text-sm text-king-gray">
                {user.email ?? (user.loginPhone ? formatPhone(user.loginPhone) : "")} · {t("memberSince", { date: fmtDate(user.createdAt) })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.role === "admin" && (
              <Button asChild variant="king" size="xl">
                <Link href="/admin">
                  <LayoutDashboard className="size-4" aria-hidden /> {t("admin")}
                </Link>
              </Button>
            )}
            <Button asChild variant="kingOutline" size="xl">
              <Link href="/wishlist">
                <Heart className="size-4" aria-hidden /> {t("wishlist")}
              </Link>
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="kingOutline" size="xl">
                <LogOut className="size-4" aria-hidden /> {t("signOut")}
              </Button>
            </form>
          </div>
        </div>

        {!user.email && (
          <div role="status" className="mt-8 flex flex-col gap-4 border border-king-red-line bg-king-red/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-sm text-king-white">
              <MailPlus className="mt-0.5 size-5 shrink-0 text-king-bright-red" aria-hidden />
              {t("addEmailBanner")}
            </p>
            <Button asChild variant="king" size="xl" className="shrink-0">
              <Link href="/account?tab=info#acc-email">{t("addEmail")}</Link>
            </Button>
          </div>
        )}

        {/* Tabs */}
        <nav aria-label={t("sections")} className="mt-10 flex gap-1 overflow-x-auto border-b border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ key, icon: Icon }) => (
            <Link
              key={key}
              href={key === "orders" ? "/account" : `/account?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={cn(
                "king-label relative flex h-12 shrink-0 items-center gap-2 px-4 text-[0.65rem] transition-colors",
                "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-king-bright-red after:transition-transform after:duration-500",
                tab === key ? "text-king-white after:scale-x-100" : "text-king-gray after:scale-x-0 hover:text-king-white"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`tab_${key}`)}
              {key === "orders" && orders.length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/10 px-1.5 text-[0.625rem] text-king-white">{orders.length}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-8">
          {tab === "orders" && <Orders orders={orders} open={open} />}
          {tab === "info" && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="border border-white/10 bg-king-near-black p-5 md:p-8">
                <DetailsForm
                  initial={{
                    name: user.name,
                    email: user.email ?? "",
                    phone: user.phone ? formatPhone(user.phone) : "",
                    wilaya: user.wilaya ?? "",
                    city: user.city ?? "",
                    address: user.address ?? "",
                  }}
                />
              </div>
              <aside className="space-y-3 self-start border border-white/10 bg-king-near-black p-5 text-sm">
                <p className="king-label flex items-center gap-2 text-[0.625rem] text-king-gray">
                  <MapPin className="size-3.5 text-king-bright-red" aria-hidden /> {t("savedForDelivery")}
                </p>
                <p className="font-medium text-king-white">{user.name}</p>
                <p className="text-king-muted">{user.phone ? formatPhone(user.phone) : t("noPhone")}</p>
                <p className="leading-relaxed text-king-muted">
                  {user.address && user.city ? (
                    <>
                      {user.address}
                      <br />
                      {user.city}, {user.wilaya}
                    </>
                  ) : (
                    t("noAddress")
                  )}
                </p>
              </aside>
            </div>
          )}
          {tab === "security" && (
            <div className="space-y-8">
              <div className="border border-white/10 bg-king-near-black p-5 md:p-8">
                <h2 className="king-label mb-6 text-king-white">{t("changePassword")}</h2>
                <PasswordForm />
              </div>
              {user.role !== "admin" && (
                <div className="border border-white/10 bg-king-near-black p-5 md:p-8">
                  <h2 className="king-label mb-2 text-king-white">{t("deleteAccount")}</h2>
                  <p className="mb-5 text-sm text-king-gray">{t("deleteText")}</p>
                  <DeleteAccount />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

type AccountOrder = Awaited<ReturnType<typeof accountOrders>>[number]

function Orders({ orders, open }: { orders: AccountOrder[]; open: number }) {
  const t = useTranslations("account")
  const to = useTranslations("order")
  if (!orders.length) {
    return (
      <div className="border border-dashed border-white/15 px-6 py-14 text-center">
        <Package className="mx-auto size-8 text-king-gray" aria-hidden />
        <p className="king-display mt-4 text-3xl text-king-white">{t("noOrders")}</p>
        <p className="mt-2 text-sm text-king-gray">{t("noOrdersText")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="king" size="xl">
            <Link href="/clothes">
              {t("shop")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="kingOutline" size="xl">
            <Link href="/track">{t("trackGuest")}</Link>
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {open > 0 && (
        <p className="text-sm text-king-muted">
          {t("onTheWay", { count: open })}
        </p>
      )}
      <ul className="space-y-4">
        {orders.map((o) => {
          const cancelled = o.status === "cancelled"
          const removable = cancelled || o.returned
          const step = CUSTOMER_STEPS.findIndex((s) => (s.statuses as readonly string[]).includes(o.status))
          return (
            <li key={o.id} className={cn("border border-white/10 bg-king-near-black transition-colors hover:border-white/25", removable && "opacity-80")}>
              <Link href={`/order/${encodeURIComponent(o.number)}?t=${encodeURIComponent(o.accessToken)}`} className="group block p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-king-white">{o.number}</p>
                    <p className="mt-1 text-xs text-king-gray">
                      {fmtDate(o.createdAt)} · {o.city}, {o.wilaya}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("king-label text-[0.625rem]", cancelled ? "text-king-gray line-through" : o.returned ? "text-king-gray" : o.status === "delivered" ? "text-emerald-300" : "text-king-bright-red")}>
                      {cancelled ? t("cancelled") : o.returned ? t("returned") : step >= 0 ? to(`step_${CUSTOMER_STEPS[step].key}`) : ""}
                    </p>
                    <p className="mt-1 text-sm text-king-white">{formatDA(o.total)}</p>
                  </div>
                </div>

                {!cancelled && (
                  <ol className="mt-5 grid grid-cols-3 gap-1.5" aria-label={t("progress")}>
                    {CUSTOMER_STEPS.map((s, i) => (
                      <li key={s.key} className="space-y-1.5">
                        <span className={cn("block h-1 rounded-full", i <= step ? "bg-king-bright-red" : "bg-white/10")} />
                        <span className={cn("hidden text-[0.625rem] sm:block", i <= step ? "text-king-muted" : "text-king-gray/60")}>{to(`step_${s.key}`)}</span>
                      </li>
                    ))}
                  </ol>
                )}

                <div className="mt-5 flex items-center justify-between gap-4">
                  <ul className="flex min-w-0 items-center gap-2">
                    {o.items.slice(0, 4).map((item, i) => (
                      <li key={`${item.name}-${i}`} className="relative size-12 shrink-0 overflow-hidden bg-king-card" title={`${item.name} — ${item.color} / ${item.size} × ${item.quantity}`}>
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- small order thumbnail
                          <img src={item.imageUrl} alt="" className="size-full object-cover" />
                        ) : null}
                      </li>
                    ))}
                    <li className="min-w-0 truncate pl-1 text-xs text-king-gray">
                      {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                    </li>
                  </ul>
                  <span className="king-label flex shrink-0 items-center gap-2 text-[0.625rem] text-king-muted group-hover:text-king-white">
                    {t("details")} <ArrowRight className="size-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
              </Link>
              {removable && (
                <div className="border-t border-white/[0.06] px-3 py-1.5">
                  <RemoveFromMyOrders orderId={o.id} kind={cancelled ? "cancelled" : "returned"} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="pt-2 text-sm text-king-gray">
        {t("guest")} <Link href="/track" className="text-king-white underline underline-offset-4">{t("trackHere")}</Link>.
      </p>
    </div>
  )
}

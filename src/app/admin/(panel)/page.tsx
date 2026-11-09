import Link from "next/link"
import { unstable_cache } from "next/cache"
import { Geist, Geist_Mono } from "next/font/google"

import { formatDA } from "@/lib/money"
import { db } from "@/server/db"
import { getOverview, type Overview } from "@/server/overview"
import { getSettings } from "@/server/settings"
import { listStores } from "@/server/stores"
import { AnalyticsBento, type AnalyticsBentoProps } from "@/components/ui/analytics-bento"
import { LinkButton, PageHeader, pill } from "@/components/admin/ui"

const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" })
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap" })

/** Numbers are recomputed at most every 2 minutes per shop filter. */
const cachedOverview = unstable_cache(
  (storeId: number | null, lowStockThreshold: number) => getOverview(db, { storeId, lowStockThreshold }),
  ["admin-overview"],
  { revalidate: 120, tags: ["overview"] }
)

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** KING 253 palette for category tiles: reds, bone white, greys. */
const TILE = [
  { color: "#d41414", ink: "light" },
  { color: "#f2efe9", ink: "dark" },
  { color: "#7a0b0b", ink: "light" },
  { color: "#a3a3a3", ink: "dark" },
  { color: "#ff5a4f", ink: "dark" },
  { color: "#3a3a3a", ink: "light" },
  { color: "#c9b8a6", ink: "dark" },
  { color: "#5a1a1a", ink: "light" },
] as const
const PERIOD_LABELS = ["Weekly", "Monthly", "Yearly"]
const PERIOD_COMPARE = ["last week", "last month", "last year"]
const n = (v: number) => v.toLocaleString("fr-DZ")

function bentoProps(o: Overview): Omit<AnalyticsBentoProps, "currency"> {
  return {
    revenue: {
      label: "Revenue",
      value: o.revenue.value,
      delta: o.revenue.delta,
      note: (
        <>
          Avg. order <span className="text-foreground/80">{formatDA(o.revenue.average)}</span> · vs previous 30 days
        </>
      ),
      caption: "Last 30 days",
      series: o.revenue.series.map((d) => ({
        value: d.value,
        label: new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      })),
    },
    sessions: {
      label: "Orders",
      value: o.orders.value,
      delta: o.orders.delta,
      note: "Placed by hour · last 7 days vs the 2 weeks before",
      desktop: o.orders.a,
      mobile: o.orders.b,
      labels: { desktop: o.orders.labels.desktop, mobile: o.orders.labels.mobile, prior: "Previous weeks", current: "last 7 days" },
    },
    categories: {
      title: "Sales by category",
      groups: o.categories.groups.map((g, i) => ({ id: g.id, name: g.name, ...TILE[i % TILE.length] })),
      periods: o.categories.periods.map((p, i) => ({
        label: PERIOD_LABELS[i],
        total: p.total,
        delta: p.delta,
        compare: `vs ${n(p.before)} DA ${PERIOD_COMPARE[i]}`,
      })),
      items: o.categories.items.map((c) => ({ name: c.name, group: c.group, values: c.values })),
      table: {
        columns: ["Shop", "Weekly", "Monthly", "Yearly"],
        rows: o.categories.shops.map((s) => ({ label: s.name, values: s.values.map((v) => `${n(v)} DA`) })),
      },
    },
    seasonality: { title: "Seasonality", axis: MONTHS, years: o.seasonality },
  }
}

export default async function AdminOverview({ searchParams }: PageProps<"/admin">) {
  const p = await searchParams
  const [settings, shops] = await Promise.all([getSettings(db), listStores(db, { activeOnly: true })])
  // Statistics may combine shops (this is not a list filter).
  const shop = shops.find((s) => String(s.id) === p.shop) ?? null
  const o = await cachedOverview(shop?.id ?? null, settings.lowStockThreshold)
  const k = o.kpis

  const kpis = [
    { label: "Pending", value: k.pending, hint: "To call and confirm", href: "/admin/orders?status=pending", tone: k.pending ? "red" : "" },
    { label: "Confirmed", value: k.confirmed, hint: "To deliver", href: "/admin/orders?status=confirmed", tone: "" },
    { label: "Delivered", value: k.delivered, hint: "Last 30 days", href: "/admin/orders?status=delivered", tone: "" },
    {
      label: "Returns & exchanges",
      value: k.journal.count,
      hint: k.journal.count ? `− ${formatDA(k.journal.refunded)}${k.journal.collected ? ` · + ${formatDA(k.journal.collected)}` : ""} · 30 days` : "None in 30 days",
      href: `/admin/returns${shop ? `?shop=${shop.id}` : ""}`,
      tone: "",
    },
    {
      label: "Low stock",
      value: k.lowStock.reduce((s, x) => s + x.low + x.out, 0),
      hint: k.lowStock.length ? k.lowStock.map((s) => `${s.name}: ${s.low} low · ${s.out} out`).join(" — ") : "No active shop",
      href: `/admin/inventory?filter=low${shop ? `&shop=${shop.id}` : ""}`,
      tone: "",
    },
    {
      label: "Top source",
      value: k.topSource?.label ?? "—",
      hint: k.topSource ? `${k.topSource.orders} order(s) · 30 days` : "Where did you hear about us?",
      href: "/admin/social",
      tone: "",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Overview" title="Dashboard" actions={<LinkButton href="/admin/orders?status=pending">Pending orders</LinkButton>}>
        <nav aria-label="Shop" className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin" className={pill(!shop)}>
            All shops
          </Link>
          {shops.map((s) => (
            <Link key={s.id} href={`/admin?shop=${s.id}`} className={pill(shop?.id === s.id)}>
              {s.name}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((c) => (
          <li key={c.label}>
            <Link
              href={c.href}
              className="block h-full rounded-[20px] border border-white/[0.08] bg-[#0b0b0b] p-4 transition-colors hover:border-king-bright-red/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-king-bright-red/40"
            >
              <span className="block text-[13px] text-king-gray">{c.label}</span>
              <span className={`mt-2 block truncate text-[28px] leading-none font-semibold tabular-nums ${c.tone === "red" ? "text-king-bright-red" : "text-king-white"}`}>
                {c.value}
              </span>
              <span className="mt-2 block text-xs leading-snug text-king-gray">{c.hint}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className={`dark ${geist.className}`}>
        <AnalyticsBento
          {...bentoProps(o)}
          currency="DA "
          credit={false}
          fontFamily={geist.style.fontFamily}
          monoFamily={geistMono.style.fontFamily}
          colors={{ revenue: ["#7a0b0b", "#ff3b3b"], desktop: ["#a30d0d", "#ff3b3b"], mobile: ["#6b6b6b", "#f5f5f5"], radar: "#e8282e" }}
        />
      </div>
    </div>
  )
}

import type { Metadata } from "next"

import { formatDA } from "@/lib/money"
import { db } from "@/server/db"
import { socialStats } from "@/server/admin/social"
import { Empty, PageHeader, Panel, Stat, Table, td, th } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Social media" }

const BRAND: Record<string, string> = {
  tiktok: "from-cyan-400 to-pink-500",
  instagram: "from-amber-400 via-pink-500 to-purple-600",
  facebook: "from-blue-500 to-blue-700",
  friend: "from-emerald-400 to-emerald-600",
  other: "from-white/40 to-white/20",
}

export default async function SocialPage() {
  const { sources, answered, notAsked, top } = await socialStats(db)
  const max = Math.max(1, ...sources.map((s) => s.accounts))
  const pct = (n: number) => (answered ? Math.round((n / answered) * 100) : 0)
  const social = sources.filter((s) => s.key === "tiktok" || s.key === "instagram" || s.key === "facebook")

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Marketing" title="Social media">
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          Where new customers say they found KING 253 (asked when they create an account), and what those customers bought.
        </p>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Top source" value={top ? top.label : "—"} hint={top ? `${pct(top.accounts)}% of sign-ups` : "No answers yet"} tone={top ? "red" : undefined} />
        <Stat label="Answers" value={answered} hint={notAsked ? `${notAsked} older account(s) were not asked` : undefined} />
        <Stat label="From social media" value={`${pct(social.reduce((n, s) => n + s.accounts, 0))}%`} hint="TikTok + Instagram + Facebook" />
        <Stat label="Sales from these accounts" value={formatDA(sources.reduce((n, s) => n + s.revenue, 0))} hint="Delivered, after returns" />
      </div>

      <Panel title="Sign-ups by source">
        {answered === 0 ? (
          <Empty>No answers yet — they appear as soon as new customers create an account.</Empty>
        ) : (
          <ol className="space-y-4">
            {sources.map((s) => (
              <li key={s.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-king-white">{s.label}</span>
                  <span className="text-king-muted tabular-nums">
                    {s.accounts} · <span className="text-king-white">{pct(s.accounts)}%</span>
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full bg-gradient-to-r ${BRAND[s.key] ?? BRAND.other}`} style={{ width: `${(s.accounts / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Table>
        <thead>
          <tr>
            <th className={th}>Source</th>
            <th className={`${th} text-right`}>Accounts</th>
            <th className={`${th} text-right`}>Last 30 days</th>
            <th className={`${th} text-right`}>Bought</th>
            <th className={`${th} text-right`}>Orders</th>
            <th className={`${th} text-right`}>Sales</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.key} className="hover:bg-white/[0.02]">
              <td className={td}>
                <span className="flex items-center gap-2.5">
                  <span className={`size-2.5 rounded-full bg-gradient-to-r ${BRAND[s.key] ?? BRAND.other}`} aria-hidden />
                  <span className="text-king-white">{s.label}</span>
                </span>
              </td>
              <td className={`${td} text-right tabular-nums`}>{s.accounts}</td>
              <td className={`${td} text-right tabular-nums`}>{s.last30}</td>
              <td className={`${td} text-right tabular-nums`}>
                {s.buyers}
                {s.accounts ? <span className="ml-1 text-xs text-king-gray">({Math.round((s.buyers / s.accounts) * 100)}%)</span> : null}
              </td>
              <td className={`${td} text-right tabular-nums`}>{s.orders}</td>
              <td className={`${td} text-right text-king-white tabular-nums`}>{formatDA(s.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

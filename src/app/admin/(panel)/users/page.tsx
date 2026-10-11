import type { Metadata } from "next"
import Link from "next/link"

import { db } from "@/server/db"
import { requireAdminPage } from "@/server/auth/session"
import { listUsers, userStats } from "@/server/admin/users"
import { referralLabel } from "@/lib/referral"
import { AddAdminForm, UserActions } from "@/components/admin/user-actions"
import { Badge, Empty, PageHeader, Panel, Stat, Table, inputClass, pill, td, th } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Users" }

const FILTERS = [
  ["all", "All accounts"],
  ["customer", "Customers"],
  ["admin", "Admins"],
  ["blocked", "Blocked"],
] as const

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireAdminPage()
  const p = await searchParams
  const one = (v: unknown) => (typeof v === "string" ? v : undefined)
  const f = { q: one(p.q), role: one(p.role) ?? "all", page: Number(one(p.page)) || 1 }
  const [stats, { rows, total, page, pages }] = await Promise.all([userStats(db), listUsers(db, f)])
  const qs = (patch: Record<string, string>) => `/admin/users?${new URLSearchParams({ ...(f.q ? { q: f.q } : {}), role: f.role, ...patch })}`

  // Last 30 days of sign-ups, one bar per day.
  const days = stats.days
  const max = Math.max(1, ...days.map((d) => d.count))

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Users" actions={<AddAdminForm />}>
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          Accounts created on the website (sign up) and admin accounts. People who only ordered without an account are in Customers.
        </p>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Accounts" value={stats.total} hint={`${stats.customers} customers · ${stats.admins} admin(s)`} />
        <Stat label="New — last 24 hours" value={stats.today} tone={stats.today ? "red" : undefined} />
        <Stat label="New — last 7 days" value={stats.week} />
        <Stat label="New — last 30 days" value={stats.month} hint={`${stats.withOrders} account(s) have ordered${stats.blocked ? ` · ${stats.blocked} blocked` : ""}`} />
      </div>

      <Panel title="Sign-ups — last 30 days">
        <div className="flex h-28 items-end gap-1" role="img" aria-label="New accounts per day">
          {days.map((d) => (
            <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${d.count} new account(s)`}>
              <div className={d.count ? "rounded-t bg-gradient-to-t from-king-red to-king-bright-red" : "h-px bg-white/10"} style={d.count ? { height: `${(d.count / max) * 100}%` } : undefined} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[0.65rem] text-king-gray">
          <span>{days[0].day}</span>
          <span>Peak {max} / day</span>
          <span>{days[29].day}</span>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={qs({ role: k, page: "1" })} className={pill(f.role === k)}>
            {label}
          </Link>
        ))}
        <form action="/admin/users" className="ml-auto w-full sm:w-72">
          <input type="hidden" name="role" value={f.role} />
          <input name="q" defaultValue={f.q} placeholder="Search name or email" aria-label="Search users" className={inputClass} />
        </form>
      </div>
      <p className="text-xs text-king-gray">{total} account(s)</p>

      {rows.length === 0 ? (
        <Empty>No accounts match.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Account</th>
              <th className={th}>Role</th>
              <th className={th}>Found us via</th>
              <th className={th}>Joined</th>
              <th className={th}>Last sign-in</th>
              <th className={th}>Orders</th>
              <th className={`${th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className={td}>
                  <span className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-semibold text-king-white" aria-hidden>
                      {u.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-king-white">{u.name}</span>
                      <span className="block truncate text-xs">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className={td}>
                  <span className="flex flex-wrap gap-1">
                    <Badge status={u.role === "admin" ? "ready_for_delivery" : "draft"}>{u.role === "admin" ? "Admin" : "Customer"}</Badge>
                    {u.disabledAt && <Badge status="cancelled">Blocked</Badge>}
                  </span>
                </td>
                <td className={td}>{u.role === "customer" ? referralLabel(u.referralSource) : "—"}</td>
                <td className={td}>{fmt(u.createdAt)}</td>
                <td className={td}>{u.lastSeen ? fmt(new Date(u.lastSeen)) : "—"}</td>
                <td className={td}>{u.orders}</td>
                <td className={`${td} text-right`}>
                  <UserActions user={{ id: u.id, name: u.name, role: u.role, blocked: !!u.disabledAt }} isMe={u.id === me.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex flex-wrap gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={qs({ page: String(n) })} className={pill(n === page)}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

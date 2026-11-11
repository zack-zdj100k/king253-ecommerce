import { sql, type SQL } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { lowStockByShop } from "./admin/queries"
import { netRevenueSql } from "./pricing"
import { socialStats } from "./admin/social"

/*
 * Admin Overview numbers, all from the database. A delivered order counts on
 * its delivery day; refused orders (refused or fully returned) count nowhere;
 * revenue = clothes − delivery the shop pays ± returns & exchanges (journal).
 * Days, hours and months are Algiers time. `storeId` null = all shops.
 */

const TZ = "Africa/Algiers"
const NET = netRevenueSql("o")
const DAY = 86_400_000

const pct = (now: number, before: number) => {
  if (!before) return now ? "new" : "0%"
  const v = ((now - before) / before) * 100
  return `${v < 0 ? "-" : ""}${Math.abs(v) >= 10 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1)}%`
}

type Row = Record<string, unknown>
const num = (v: unknown) => Number(v ?? 0)

export async function getOverview(db: DbOrTx, opts: { storeId: number | null; lowStockThreshold: number; now?: Date }) {
  const now = opts.now ?? new Date()
  const shop: SQL = opts.storeId ? sql`and o.store_id = ${opts.storeId}` : sql``
  const live = sql`o.status = 'delivered' and o.payment_status <> 'refused' and o.delivered_at is not null ${shop}`
  // Raw queries take timestamps as ISO strings.
  const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString()
  const nowIso = now.toISOString()
  const run = async (q: SQL) => (await db.execute(q)) as unknown as Row[]

  const shops = await run(sql`select id, name from stores where active order by sort_order, name`)

  /* ---------------- KPIs ---------------- */
  const [counts] = await run(sql`select
      count(*) filter (where o.status in ('pending', 'contacting'))::int as pending,
      count(*) filter (where o.status in ('confirmed', 'preparing', 'ready_for_delivery'))::int as confirmed,
      count(*) filter (where ${live} and o.delivered_at >= ${ago(30)})::int as delivered
    from orders o where true ${shop}`)
  const [journal] = await run(sql`select count(*)::int as n,
      coalesce(-sum(j.amount) filter (where j.amount < 0), 0)::int as refunded,
      coalesce(sum(j.amount) filter (where j.amount > 0), 0)::int as collected
    from return_journal j join orders o on o.id = j.order_id
    where j.created_at >= ${ago(30)} ${opts.storeId ? sql`and j.store_id = ${opts.storeId}` : sql``}`)
  // Same numbers as Admin → Social media (sign-ups by "where did you hear about us").
  const social = await socialStats(db)
  const lowStock = (await lowStockByShop(db, opts.lowStockThreshold)).filter((s) => !opts.storeId || s.storeId === opts.storeId)

  /* ---------------- Revenue, last 30 days ---------------- */
  const daily = await run(sql`with d as (
      select generate_series(date_trunc('day', ${ago(29)}::timestamptz at time zone ${TZ}), date_trunc('day', ${nowIso}::timestamptz at time zone ${TZ}), interval '1 day') as day)
    select to_char(d.day, 'YYYY-MM-DD') as day,
      coalesce((select sum(${NET}) from orders o where ${live} and date_trunc('day', o.delivered_at at time zone ${TZ}) = d.day), 0)::int as value
    from d order by d.day`)
  const [rev] = await run(sql`select
      coalesce(sum(${NET}) filter (where o.delivered_at >= ${ago(30)}), 0)::int as now,
      coalesce(sum(${NET}) filter (where o.delivered_at >= ${ago(60)} and o.delivered_at < ${ago(30)}), 0)::int as before,
      count(*) filter (where o.delivered_at >= ${ago(30)})::int as orders
    from orders o where ${live}`)

  /* ---------------- Orders by hour: this week vs the 2 weeks before ---------------- */
  // Two lines: shop 1 vs the other shops (all shops) — or home vs stop desk (one shop).
  const split = opts.storeId
    ? { a: sql`o.delivery_type = 'home'`, b: sql`o.delivery_type = 'desk'`, labels: { desktop: "Home delivery", mobile: "Stop desk" } }
    : {
        a: sql`o.store_id = ${num(shops[0]?.id)}`,
        b: sql`o.store_id is distinct from ${num(shops[0]?.id)}`,
        labels: { desktop: String(shops[0]?.name ?? "Shop 1"), mobile: shops.length === 2 ? String(shops[1].name) : "Other shops" },
      }
  const hourly = await run(sql`select w, h,
      count(*) filter (where ${split.a})::int as a, count(*) filter (where ${split.b})::int as b
    from (select floor(extract(epoch from (${nowIso}::timestamptz - o.created_at)) / 604800)::int as w,
        extract(hour from o.created_at at time zone ${TZ})::int as h, o.store_id, o.delivery_type
      from orders o where o.created_at >= ${ago(21)} and o.status <> 'cancelled' ${shop}) o
    where w between 0 and 2 group by w, h`)
  const series = (key: "a" | "b") => [0, 1, 2].map((w) => Array.from({ length: 24 }, (_, h) => num(hourly.find((r) => num(r.w) === w && num(r.h) === h)?.[key])))
  const weekTotal = (w: number) => hourly.filter((r) => num(r.w) === w).reduce((s, r) => s + num(r.a) + num(r.b), 0)

  /* ---------------- Sales by category: week / month / year ---------------- */
  const PERIODS = [7, 30, 365]
  const cats = await run(sql`select c.id, c.name, c.parent_id as parent, coalesce(p.name, c.name) as group_name, coalesce(c.parent_id, c.id) as group_id
    from categories c left join categories p on p.id = c.parent_id where c.active order by coalesce(p.sort_order, c.sort_order), c.sort_order`)
  const line = sql`(oi.unit_price * (oi.quantity - oi.returned_quantity))`
  const catSales = await run(sql`select pr.category_id as id,
      ${sql.join(
        PERIODS.flatMap((d) => [
          sql`coalesce(sum(${line}) filter (where o.delivered_at >= ${ago(d)}), 0)::int as ${sql.raw(`p${d}`)}`,
          sql`coalesce(sum(${line}) filter (where o.delivered_at >= ${ago(2 * d)} and o.delivered_at < ${ago(d)}), 0)::int as ${sql.raw(`q${d}`)}`,
        ]),
        sql`, `
      )}
    from order_items oi join orders o on o.id = oi.order_id join products pr on pr.id = oi.product_id
    where ${live} and oi.removed_at is null and o.delivered_at >= ${ago(730)} group by pr.category_id`)
  const shopSales = await run(sql`select s.name,
      ${sql.join(
        PERIODS.map((d) => sql`coalesce(sum(${NET}) filter (where o.delivered_at >= ${ago(d)}), 0)::int as ${sql.raw(`p${d}`)}`),
        sql`, `
      )}
    from stores s left join orders o on o.store_id = s.id and ${live}
    where s.active ${opts.storeId ? sql`and s.id = ${opts.storeId}` : sql``} group by s.id, s.name, s.sort_order order by s.sort_order, s.name`)
  const catRows = cats.map((c) => {
    const s = catSales.find((r) => num(r.id) === num(c.id))
    return { name: String(c.name), group: String(c.group_id), values: PERIODS.map((d) => num(s?.[`p${d}`])), before: PERIODS.map((d) => num(s?.[`q${d}`])) }
  })
  // A main category that has subcategories is shown through them (plus its own direct sales).
  const items = catRows.filter((c) => c.values.some((v) => v > 0))
  const groups = [...new Map(cats.map((c) => [String(c.group_id), String(c.group_name)])).entries()].map(([id, name]) => ({ id, name }))
  const totals = PERIODS.map((_, i) => catRows.reduce((s, c) => s + c.values[i], 0))
  const totalsBefore = PERIODS.map((_, i) => catRows.reduce((s, c) => s + c.before[i], 0))

  /* Line chart per category: last 7 days (daily), last 30 days (daily), last 12 months (monthly). */
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
  const monthKey = (d: Date) => dayKey(d).slice(0, 7)
  const catDaily = await run(sql`select pr.category_id as id, to_char(o.delivered_at at time zone ${TZ}, 'YYYY-MM-DD') as k, coalesce(sum(${line}), 0)::int as v
    from order_items oi join orders o on o.id = oi.order_id join products pr on pr.id = oi.product_id
    where ${live} and oi.removed_at is null and o.delivered_at >= ${ago(31)} group by 1, 2`)
  const catMonthly = await run(sql`select pr.category_id as id, to_char(o.delivered_at at time zone ${TZ}, 'YYYY-MM') as k, coalesce(sum(${line}), 0)::int as v
    from order_items oi join orders o on o.id = oi.order_id join products pr on pr.id = oi.product_id
    where ${live} and oi.removed_at is null and o.delivered_at >= ${ago(370)} group by 1, 2`)
  const dayKeys = (n: number) => Array.from({ length: n }, (_, i) => dayKey(new Date(now.getTime() - (n - 1 - i) * DAY)))
  const monthKeys = (() => {
    const [y, m] = monthKey(now).split("-").map(Number)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1))
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    })
  })()
  const seriesOf = (rows: Row[], keys: string[]) =>
    cats
      .map((c) => ({
        name: String(c.name),
        values: keys.map((k) => num(rows.find((r) => num(r.id) === num(c.id) && String(r.k) === k)?.v)),
      }))
      .filter((l) => l.values.some((v) => v > 0))
  const lineSeries = [
    { keys: dayKeys(7), lines: seriesOf(catDaily, dayKeys(7)) },
    { keys: dayKeys(30), lines: seriesOf(catDaily, dayKeys(30)) },
    { keys: monthKeys, lines: seriesOf(catMonthly, monthKeys) },
  ]

  /* ---------------- Seasonality: months of this year and last year ---------------- */
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: TZ, year: "numeric" }).format(now))
  const monthly = await run(sql`select extract(year from o.delivered_at at time zone ${TZ})::int as y, extract(month from o.delivered_at at time zone ${TZ})::int as m,
      coalesce(sum(${NET}), 0)::int as v, count(*)::int as n
    from orders o where ${live} and extract(year from o.delivered_at at time zone ${TZ}) in (${year}, ${year - 1}, ${year - 2}) group by 1, 2`)
  const yearShops = await run(sql`select s.name, extract(year from o.delivered_at at time zone ${TZ})::int as y, coalesce(sum(${NET}), 0)::int as v
    from stores s join orders o on o.store_id = s.id and ${live}
    where s.active ${opts.storeId ? sql`and s.id = ${opts.storeId}` : sql``} group by 1, 2`)
  const yearOf = (y: number) => {
    const values = Array.from({ length: 12 }, (_, m) => num(monthly.find((r) => num(r.y) === y && num(r.m) === m + 1)?.v))
    const orders = monthly.filter((r) => num(r.y) === y).reduce((s, r) => s + num(r.n), 0)
    return { values, total: values.reduce((a, b) => a + b, 0), orders }
  }
  const years = [year, year - 1].map((y) => {
    const cur = yearOf(y)
    const prev = yearOf(y - 1)
    const months = y === year ? Number(new Intl.DateTimeFormat("en", { timeZone: TZ, month: "numeric" }).format(now)) : 12
    return {
      label: String(y),
      values: cur.values,
      stats: [
        { label: "Monthly avg", value: Math.round(cur.total / months), delta: pct(cur.total / months, prev.total / 12), note: `${cur.orders} orders` },
        { label: "Year total", value: cur.total, delta: pct(cur.total, prev.total), note: `vs ${prev.total} DA` },
      ],
      rows: yearShops.filter((r) => num(r.y) === y).map((r) => ({ label: String(r.name), value: `${num(r.v)} DA` })),
    }
  })

  return {
    kpis: {
      pending: num(counts?.pending),
      confirmed: num(counts?.confirmed),
      delivered: num(counts?.delivered),
      journal: { count: num(journal?.n), refunded: num(journal?.refunded), collected: num(journal?.collected) },
      lowStock: lowStock.map((s) => ({ storeId: s.storeId, name: s.storeName, low: s.low, out: s.out })),
      topSource: social.top
        ? { label: social.top.label, accounts: social.top.accounts, share: Math.round((social.top.accounts / social.answered) * 100) }
        : null,
    },
    revenue: {
      value: num(rev?.now),
      delta: pct(num(rev?.now), num(rev?.before)),
      average: num(rev?.orders) ? Math.round(num(rev?.now) / num(rev?.orders)) : 0,
      series: daily.map((d) => ({ day: String(d.day), value: num(d.value) })),
    },
    orders: { value: weekTotal(0), delta: pct(weekTotal(0), weekTotal(1)), a: series("a"), b: series("b"), labels: split.labels },
    categories: {
      groups,
      items,
      periods: PERIODS.map((d, i) => ({ days: d, total: totals[i], before: totalsBefore[i], delta: pct(totals[i], totalsBefore[i]) })),
      shops: shopSales.map((r) => ({ name: String(r.name), values: PERIODS.map((d) => num(r[`p${d}`])) })),
      series: lineSeries,
    },
    seasonality: years,
  }
}

export type Overview = Awaited<ReturnType<typeof getOverview>>

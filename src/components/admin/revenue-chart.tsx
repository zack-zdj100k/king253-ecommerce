"use client"

import * as React from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/line-charts-6"

type Day = { day: string; revenue: number; sales: number; orders: number; units: number }
type Totals = { revenue: number; sales: number; orders: number; units: number }
type MetricKey = keyof Totals

const METRICS: { key: MetricKey; label: string; hint: string; money: boolean }[] = [
  { key: "revenue", label: "Net revenue", hint: "after refunds & delivery paid", money: true },
  { key: "sales", label: "Sales", hint: "clothes ordered", money: true },
  { key: "orders", label: "Orders", hint: "not cancelled", money: false },
  { key: "units", label: "Units", hint: "pieces ordered", money: false },
]

// iOS system colours; KING red for the money that matters most.
const chartConfig = {
  revenue: { label: "Net revenue", color: "#e8282e" },
  sales: { label: "Sales", color: "#0a84ff" },
  orders: { label: "Orders", color: "#ff9f0a" },
  units: { label: "Units", color: "#30d158" },
} satisfies ChartConfig

const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
const compactDA = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n))

function Change({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return current === 0 ? null : <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-white/70">New</span>
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const up = pct >= 0
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", up ? "bg-[#30d158]/15 text-[#5ee07f]" : "bg-[#ff453a]/15 text-[#ff8a84]")}>
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {Math.abs(pct) >= 1000 ? "999+" : Math.abs(pct).toFixed(1)}%
    </span>
  )
}

/** Daily performance: pick a metric, see its line over the period and the change vs the previous period. */
export function RevenueChart({ data, from, to, current, previous }: { data: Day[]; from: string; to: string; current: Totals; previous: Totals }) {
  const [selected, setSelected] = React.useState<MetricKey>("revenue")
  const metric = METRICS.find((m) => m.key === selected)!
  const color = chartConfig[selected].color
  const format = (n: number) => (metric.money ? formatDA(n) : n.toLocaleString("en-GB"))

  // Every day of the period, with zeros on days without orders.
  const days = React.useMemo(() => {
    const out: Day[] = []
    for (let t = new Date(from).getTime(); t < new Date(to).getTime(); t += 86_400_000) {
      const day = new Date(t + 12 * 3_600_000).toISOString().slice(0, 10)
      out.push(data.find((d) => d.day === day) ?? { day, revenue: 0, sales: 0, orders: 0, units: 0 })
    }
    return out
  }, [data, from, to])
  const hasNegative = days.some((d) => d[selected] < 0)

  return (
    <div className="overflow-hidden rounded-[20px] bg-[color:var(--ios-cell)]">
      {/* Metric tiles */}
      <div className="grid grid-cols-2 border-b border-[var(--ios-sep)] lg:grid-cols-4" role="tablist" aria-label="Chart metric">
        {METRICS.map((m, i) => {
          const active = m.key === selected
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(m.key)}
              className={cn(
                "relative min-w-0 p-4 text-start transition-colors sm:p-5",
                i % 2 === 0 && "border-e border-[var(--ios-sep)]",
                i < 2 && "border-b border-[var(--ios-sep)] lg:border-b-0",
                i === 1 && "lg:border-e",
                active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
              )}
            >
              {active && <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: chartConfig[m.key].color }} aria-hidden />}
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[var(--ios-label-2)]">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: chartConfig[m.key].color }} aria-hidden />
                  {m.label}
                </span>
                <Change current={current[m.key]} previous={previous[m.key]} />
              </span>
              <span className="mt-2 block truncate text-[22px] font-bold tracking-[-0.03em] text-white tabular-nums sm:text-[26px]">
                {m.money ? formatDA(current[m.key]) : current[m.key].toLocaleString("en-GB")}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-[var(--ios-label-2)]">
                from {m.money ? formatDA(previous[m.key]) : previous[m.key].toLocaleString("en-GB")} · {m.hint}
              </span>
            </button>
          )
        })}
      </div>

      {/* Line chart on a dot grid */}
      <div className="px-2 pt-6 pb-3 sm:px-4">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-64 w-full bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] bg-[length:20px_20px] sm:h-80"
        >
          <LineChart data={days} margin={{ top: 16, right: 16, left: 4, bottom: 4 }} style={{ overflow: "visible" }}>
            <defs>
              <filter id="kingLineShadow" x="-100%" y="-100%" width="300%" height="300%">
                <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor={color} floodOpacity="0.45" />
              </filter>
              <filter id="kingDotShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.6)" />
              </filter>
            </defs>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={28}
              tick={{ fontSize: 11, fill: "rgba(235,235,245,0.6)" }}
              tickFormatter={shortDay}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={44}
              tickCount={5}
              allowDecimals={!metric.money ? false : true}
              tick={{ fontSize: 11, fill: "rgba(235,235,245,0.6)" }}
              tickFormatter={(v: number) => (metric.money ? compactDA(v) : String(v))}
            />
            {hasNegative && <ReferenceLine y={0} stroke="rgba(235,235,245,0.3)" strokeDasharray="4 4" />}
            <ChartTooltip
              cursor={{ stroke: "rgba(235,235,245,0.35)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                const value = payload?.[0]?.value
                if (!active || typeof value !== "number") return null
                return (
                  <div className="min-w-[140px] rounded-[12px] bg-[#2c2c2e]/95 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                    <p className="text-[12px] text-[var(--ios-label-2)]">{shortDay(String(label))}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold text-white tabular-nums">
                      <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                      {format(value)}
                    </p>
                  </div>
                )
              }}
            />
            <Line
              key={selected}
              type="monotone"
              dataKey={selected}
              stroke={color}
              strokeWidth={2.5}
              filter="url(#kingLineShadow)"
              dot={days.length <= 1 ? { r: 4, fill: color, strokeWidth: 0 } : false}
              activeDot={{ r: 6, fill: color, stroke: "#fff", strokeWidth: 2, filter: "url(#kingDotShadow)" }}
              animationDuration={600}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  )
}

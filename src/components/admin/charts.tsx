import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import { segment, segmentTrack } from "@/components/admin/ui"

/** Horizontal ranking bars. */
export function RankList({ items, format = (n: number) => String(n), empty }: { items: { label: string; value: number; href?: string }[]; format?: (n: number) => string; empty: string }) {
  if (!items.length) return <p className="text-sm text-king-gray">{empty}</p>
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate text-king-muted">{item.href ? <a href={item.href} className="hover:text-king-white">{item.label}</a> : item.label}</span>
            <span className="shrink-0 text-king-white tabular-nums">{format(item.value)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-[color:var(--ios-tint)]" style={{ width: `${Math.max(0, item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

export function RangeTabs({ current, base, label }: { current: string; base: string; label: string }) {
  const keys = [
    ["today", "Today"],
    ["7d", "7 days"],
    ["30d", "30 days"],
    ["90d", "90 days"],
  ] as const
  return (
    <div className="flex flex-col gap-3">
      {/* iOS segmented control */}
      <div className={cn(segmentTrack, "w-full max-w-md")} role="tablist" aria-label="Period">
        {keys.map(([k, l]) => (
          <a key={k} href={`${base}?range=${k}`} role="tab" aria-selected={current === k} aria-current={current === k ? "page" : undefined} className={segment(current === k)}>
            {l}
          </a>
        ))}
      </div>
      <form action={base} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="range" value="custom" />
        <input type="date" name="from" aria-label="From" className="h-9 rounded-[10px] bg-[color:var(--ios-cell-2)] px-3 text-[14px] text-white [color-scheme:dark]" />
        <span className="text-[13px] text-[var(--ios-label-3)]">to</span>
        <input type="date" name="to" aria-label="To" className="h-9 rounded-[10px] bg-[color:var(--ios-cell-2)] px-3 text-[14px] text-white [color-scheme:dark]" />
        <button type="submit" className="h-9 rounded-full px-3 text-[15px] font-semibold text-[var(--ios-tint)] transition-opacity hover:opacity-70">Apply</button>
        <span className="text-[13px] text-[var(--ios-label-2)]">{label}</span>
      </form>
    </div>
  )
}

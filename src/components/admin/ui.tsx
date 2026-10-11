import Link from "next/link"

import { cn } from "@/lib/utils"

/*
 * Admin design system — Apple iOS / iPadOS language, KING red as the tint.
 * Large titles, inset-grouped cells (#1c1c1e on black), capsule buttons,
 * segmented controls, tinted status capsules. Tokens: .ios-admin in globals.css.
 */

export function PageHeader({ eyebrow, title, actions, children }: { eyebrow?: string; title: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 pb-1 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-[13px] font-semibold text-[var(--ios-tint)]">{eyebrow}</p>}
        {/* iOS Large Title */}
        <h1 className="mt-0.5 text-[34px] leading-[1.1] font-bold tracking-[-0.025em] break-words text-white md:text-[40px]">{title}</h1>
        {children && <div className="text-[15px] text-[var(--ios-label-2)]">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Inset grouped section: small header above a rounded cell, like iOS Settings. */
export function Panel({ title, actions, className, children }: { title?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("min-w-0", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-2">
          {title && <h2 className="text-[13px] font-semibold tracking-[0.01em] text-[var(--ios-label-2)] uppercase">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="rounded-[20px] bg-[color:var(--ios-cell)] p-5">{children}</div>
    </section>
  )
}

/** iOS widget-style number tile. */
export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "red" }) {
  return (
    <div className={cn("relative min-w-0 overflow-hidden rounded-[22px] p-4 [container-type:inline-size] sm:p-5", tone === "red" ? "bg-gradient-to-b from-[#3a0d0f] to-[var(--ios-cell)]" : "bg-[color:var(--ios-cell)]")}>
      <p className={cn("text-[13px] font-semibold", tone === "red" ? "text-[var(--ios-tint)]" : "text-[var(--ios-label-2)]")}>{label}</p>
      <p className="mt-2 text-[clamp(1.15rem,17cqi,2.1rem)] leading-tight font-bold tracking-[-0.03em] whitespace-nowrap text-white tabular-nums">{value}</p>
      {hint && <div className="mt-1.5 text-[12px] leading-snug text-[var(--ios-label-2)]">{hint}</div>}
    </div>
  )
}

/* Status = tinted capsule (iOS-style tag). Colour carries meaning. */
const TONES = {
  neutral: "bg-white/[0.1] text-white/80",
  info: "bg-[#0a84ff]/20 text-[#64b5ff]",
  warn: "bg-[#ff9f0a]/20 text-[#ffc266]",
  red: "bg-[color:var(--ios-tint)]/25 text-[#ff8a8d]",
  good: "bg-[#30d158]/20 text-[#5ee07f]",
  muted: "bg-white/[0.06] text-white/45",
} as const
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  pending: "warn",
  contacting: "info",
  confirmed: "info",
  preparing: "info",
  ready_for_delivery: "red",
  delivered: "good",
  cancelled: "muted",
  published: "good",
  draft: "neutral",
  archived: "muted",
  requested: "warn",
  approved: "info",
  rejected: "muted",
  received: "info",
  completed: "good",
}

export function Badge({ status, children }: { status: string; children: React.ReactNode }) {
  const tone = STATUS_TONE[status] ?? "neutral"
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap capitalize", TONES[tone], status === "cancelled" && "line-through")}>
      {children}
    </span>
  )
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative min-w-0 max-w-full overflow-x-auto rounded-[20px] bg-[color:var(--ios-cell)]", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-[15px] [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-white/[0.04] [&_tbody_tr:last-child_td]:border-b-0">{children}</table>
    </div>
  )
}
export const th = "border-b border-[var(--ios-sep)] px-4 py-3 text-[12px] font-semibold text-[var(--ios-label-2)]"
export const td = "border-b border-[var(--ios-sep)] px-4 py-3.5 align-middle text-white/80"

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[20px] bg-[color:var(--ios-cell)] px-6 py-12 text-center text-[15px] text-[var(--ios-label-2)]">{children}</p>
}

/* iOS buttons — Filled (one primary action), Tinted gray (secondary), Plain (quiet). */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-semibold whitespace-nowrap transition-[background-color,color,transform,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ios-tint)] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.96] active:opacity-80 disabled:pointer-events-none disabled:opacity-40"
export const btnRed = cn(btnBase, "h-11 bg-[color:var(--ios-tint)] px-5 text-white hover:brightness-110")
export const btnOutline = cn(btnBase, "h-11 bg-[color:var(--ios-fill)] px-5 text-white hover:bg-[rgba(118,118,128,0.34)]")
export const btnGhost = cn(btnBase, "h-9 px-3 text-[var(--ios-tint)] hover:bg-white/[0.06]")

export function LinkButton({ href, children, variant = "outline" }: { href: string; children: React.ReactNode; variant?: "red" | "outline" }) {
  return (
    <Link href={href} className={variant === "red" ? btnRed : btnOutline}>
      {children}
    </Link>
  )
}

/** Capsule filters / pagination; the selected one is white like an iOS segmented thumb. */
export function pill(active: boolean) {
  return cn(
    "inline-flex h-8 items-center justify-center rounded-full px-3.5 text-[13px] font-semibold transition-[background-color,color] duration-200",
    active ? "bg-white text-black shadow-[0_3px_8px_rgba(0,0,0,0.25)]" : "bg-[color:var(--ios-fill)] text-white/75 hover:text-white"
  )
}

/** One segment inside an iOS segmented control track (see SegmentedTrack). */
export function segment(active: boolean) {
  return cn(
    "inline-flex h-7 flex-1 items-center justify-center rounded-[7px] px-3 text-[13px] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
    active ? "bg-[#636366] text-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]" : "text-white/80 hover:text-white"
  )
}
export const segmentTrack = "inline-flex items-center gap-0.5 rounded-[9px] bg-[color:var(--ios-fill)] p-0.5"

export const inputClass =
  "h-11 w-full rounded-[12px] border-0 bg-[color:var(--ios-cell-2)] px-3.5 text-[16px] text-white transition-shadow placeholder:text-[var(--ios-label-3)] focus-visible:ring-2 focus-visible:ring-[var(--ios-tint)]/70 focus-visible:outline-none disabled:opacity-50 md:text-[15px]"
export const selectClass = cn(
  inputClass,
  "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ebebf599' stroke-width='2.5'%3E%3Cpath d='m7 9 5 5 5-5'/%3E%3C/svg%3E\")] bg-[length:12px] bg-[position:right_0.9rem_center] bg-no-repeat pr-9"
)
export const textareaClass =
  "w-full rounded-[12px] border-0 bg-[color:var(--ios-cell-2)] p-3.5 text-[16px] text-white transition-shadow placeholder:text-[var(--ios-label-3)] focus-visible:ring-2 focus-visible:ring-[var(--ios-tint)]/70 focus-visible:outline-none md:text-[15px]"
export const labelClass = "mb-1.5 block pl-1 text-[13px] font-medium text-[var(--ios-label-2)]"

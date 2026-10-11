import Link from "next/link"

import { cn } from "@/lib/utils"

export function Logo({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label="KING 253 — home"
      className={cn("group inline-flex items-baseline gap-1.5 text-king-white", className)}
    >
      <span className="text-[1.05rem] font-black tracking-[-0.04em] uppercase">King</span>
      <span className="text-[1.05rem] font-black tracking-[-0.04em] text-king-bright-red transition-[text-shadow] duration-500 group-hover:[text-shadow:0_0_18px_rgba(255,26,26,0.8)]">
        253
      </span>
    </Link>
  )
}

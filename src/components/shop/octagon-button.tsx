"use client"

import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

/** FRZN-style octagon action: outlined octagon + label and price beside it. */
export function OctagonButton({
  label,
  detail,
  onClick,
  className,
}: {
  label: string
  detail?: string
  onClick: () => void
  className?: string
}) {
  return (
    <button type="button" onClick={onClick} className={cn("group inline-flex items-center gap-5 text-left outline-none", className)}>
      <span className="relative grid size-20 shrink-0 place-items-center md:size-24">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full transition-transform duration-700 ease-king group-hover:rotate-[22.5deg] group-focus-visible:rotate-[22.5deg] motion-reduce:transition-none" aria-hidden>
          <polygon
            points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30"
            className="fill-transparent stroke-white/40 transition-[fill,stroke] duration-500 group-hover:fill-king-red group-hover:stroke-king-bright-red group-focus-visible:stroke-king-bright-red"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <ArrowUpRight className="relative size-6 text-king-white transition-transform duration-500 group-hover:rotate-45" aria-hidden />
      </span>
      <span>
        <span className="king-label block text-[0.6rem] text-king-muted transition-colors group-hover:text-king-white">{label}</span>
        {detail && <span className="mt-1.5 block text-2xl font-medium tracking-tight text-king-white md:text-3xl">{detail}</span>}
      </span>
    </button>
  )
}

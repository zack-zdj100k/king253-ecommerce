"use client"

import type { FC } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

interface Props {
  label: string
  variant?: "primary" | "secondary"
  classes?: string
  /** Renders a Next.js link instead of a <button>. */
  href?: string
  type?: "button" | "submit"
  onClick?: () => void
}

/**
 * Pill button whose circle expands to fill the button on hover.
 * primary   — black pill, red circle (main call to action)
 * secondary — black pill, white circle
 * Width follows the label, so long labels never overflow.
 */
const MotionButton: FC<Props> = ({ label, variant = "primary", classes, href, type = "button", onClick }) => {
  const primary = variant === "primary"

  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "circle absolute top-1 bottom-1 left-1 block w-12 overflow-hidden rounded-full transition-[width] duration-500 ease-king group-hover:w-[calc(100%-0.5rem)] group-focus-visible:w-[calc(100%-0.5rem)] motion-reduce:transition-none",
          primary ? "bg-king-red shadow-[0_0_40px_-8px_rgba(255,26,26,0.7)]" : "bg-king-white"
        )}
      />
      <span
        aria-hidden="true"
        className="icon absolute top-1/2 left-4 -translate-y-1/2 transition-transform duration-500 ease-king group-hover:translate-x-[0.4rem] group-focus-visible:translate-x-[0.4rem] motion-reduce:transition-none"
      >
        <ArrowRight className={cn("size-6", primary ? "text-king-white" : "text-king-black")} />
      </span>
      <span
        className={cn(
          "button-text relative text-center text-lg font-medium tracking-tight whitespace-nowrap text-king-white transition-colors duration-500 motion-reduce:transition-none",
          !primary && "group-hover:text-king-black group-focus-visible:text-king-black"
        )}
      >
        {label}
      </span>
    </>
  )

  const className = cn(
    "group relative inline-flex h-14 cursor-pointer items-center rounded-full border border-white/15 bg-king-black py-1 pr-7 pl-[4.25rem] outline-none",
    "focus-visible:ring-2 focus-visible:ring-king-bright-red focus-visible:ring-offset-2 focus-visible:ring-offset-king-black",
    classes
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} className={className}>
      {content}
    </button>
  )
}

export default MotionButton

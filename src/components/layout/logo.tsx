import Link from "next/link"

import { cn } from "@/lib/utils"
import { BrandMark } from "@/components/layout/brand-mark"

/** Header / menu logo: the real KING 253 artwork with a red glow and a moving red light. */
export function Logo({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} aria-label="KING 253 — home" dir="ltr" className={cn("group inline-flex items-center", className)}>
      <BrandMark className="w-[5.4rem] sm:w-[6rem] lg:w-[7rem]" />
    </Link>
  )
}

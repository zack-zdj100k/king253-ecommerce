import { cn } from "@/lib/utils"

/**
 * The KING 253 graffiti logo (white lettering, traced from the owner's artwork).
 * The shape is a CSS mask, so it can glow red, and a red light sweeps across it (see .king-logo in globals.css).
 * Width is set by the caller; the height follows the artwork's proportions.
 */
export function BrandMark({ className, hover = true }: { className?: string; hover?: boolean }) {
  return (
    <span aria-hidden className={cn("king-logo", hover && "king-logo-hover", className)}>
      <span className="king-logo-base" />
      <span className="king-logo-sweep" />
    </span>
  )
}

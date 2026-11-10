import Image from "next/image"
import { Package } from "lucide-react"

import { cn } from "@/lib/utils"

/** One product as the admin reads it: photo, category › subcategory, full name, colour, size, quantity. */
export type LineView = {
  name: string
  image: string | null
  category: string | null
  parentCategory: string | null
  color: string
  colorHex: string | null
  size: string
  quantity: number
}

export function ProductLine({
  line,
  aside,
  badge,
  className,
  quantityLabel = "Qty",
}: {
  line: LineView
  /** Right column (prices, steppers…); drops under the name on phones. */
  aside?: React.ReactNode
  /** Small tag above the name ("Came back", "Given to the customer"…). */
  badge?: React.ReactNode
  className?: string
  quantityLabel?: string
}) {
  const path = [line.parentCategory, line.category].filter(Boolean).join(" › ")
  return (
    <div className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-4", className)}>
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/10 md:size-20">
        {line.image ? (
          <Image src={line.image} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-king-gray" aria-hidden>
            <Package className="size-6" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        {badge}
        {path && <p className="text-[0.7rem] font-medium tracking-wide text-king-gray uppercase">{path}</p>}
        <p className="text-[0.95rem] leading-snug font-semibold break-words text-king-white md:text-base">{line.name}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-king-gray">
            <span className="size-3 rounded-full ring-1 ring-white/30" style={{ backgroundColor: line.colorHex ?? "#555" }} aria-hidden />
            Colour <span className="font-semibold text-king-white">{line.color}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-king-gray">
            Size <span className="font-semibold text-king-white">{line.size}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-king-bright-red/30 bg-king-red/10 px-2.5 py-1 text-king-muted">
            {quantityLabel} <span className="font-semibold text-king-white">{line.quantity}</span>
          </span>
        </div>
      </div>
      {aside && <div className="col-start-2 sm:col-start-auto sm:text-right">{aside}</div>}
    </div>
  )
}

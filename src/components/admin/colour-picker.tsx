"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { GARMENT_COLOURS, isHex, searchColours } from "@/lib/colours"

/**
 * Swatch picker for garment colours: a searchable palette (English, French or
 * Arabic names) plus a hex field. Replaces the browser's native colour dialog, which is hard to use
 * on small screens.
 */
export function ColourPicker({
  value,
  onChange,
  label = "Swatch",
  className,
}: {
  value: string
  onChange: (hex: string, name?: string) => void
  label?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const [query, setQuery] = React.useState("")
  const found = searchColours(query)
  const currentName = GARMENT_COLOURS.find((c) => c.hex.toLowerCase() === (isHex(value) ? value : "").toLowerCase())?.name
  const root = React.useRef<HTMLDivElement>(null)
  const current = isHex(value) ? value : "#222222"
  const typed = draft.startsWith("#") ? draft : `#${draft}`
  const applyTyped = () => {
    if (!isHex(typed)) return
    onChange(typed.toLowerCase())
    setOpen(false)
  }

  React.useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [open])

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          setDraft(current)
          setQuery("")
          setOpen((o) => !o)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${current}`}
        className="flex h-10 items-center gap-2 rounded-full border border-white/12 bg-black/40 pr-3 pl-1.5 text-king-muted transition-colors hover:border-white/30 focus-visible:border-king-bright-red focus-visible:outline-none"
      >
        <span className="size-7 rounded-full ring-1 ring-white/25" style={{ backgroundColor: current }} aria-hidden />
        <ChevronDown className="size-3.5" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a colour"
          className="absolute top-12 left-0 z-50 w-[min(21rem,calc(100vw-2.5rem))] rounded-2xl border border-white/10 bg-king-near-black p-3 shadow-2xl shadow-black/60"
        >
          <label className="mb-3 flex h-9 items-center gap-2 rounded-full border border-white/12 bg-black/50 px-3 focus-within:border-king-bright-red">
            <Search className="size-3.5 shrink-0 text-king-gray" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (found[0]) {
                    onChange(found[0].hex, found[0].name)
                    setOpen(false)
                  }
                }
              }}
              placeholder="Search: navy, bordeaux, kaki…"
              aria-label="Search colours"
              className="min-w-0 flex-1 bg-transparent text-xs text-king-white placeholder:text-king-gray focus-visible:outline-none"
            />
          </label>
          <p className="mb-2 text-xs text-king-gray">
            {query ? `${found.length} colour${found.length === 1 ? "" : "s"}` : `${GARMENT_COLOURS.length} colours`}
            {currentName ? ` · now: ${currentName}` : ""}
          </p>
          {found.length === 0 && <p className="py-4 text-center text-xs text-king-gray">No colour with that name — type its hex code below.</p>}
          <div className="grid max-h-56 grid-cols-8 gap-1.5 overflow-y-auto p-0.5">
            {found.map((c) => {
              const active = c.hex.toLowerCase() === current.toLowerCase()
              return (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={active}
                  onClick={() => {
                    onChange(c.hex, c.name)
                    setOpen(false)
                  }}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-full ring-1 ring-white/20 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-king-bright-red",
                    active && "ring-2 ring-king-bright-red"
                  )}
                  style={{ backgroundColor: c.hex }}
                >
                  {active && <Check className="size-3.5 text-white mix-blend-difference" aria-hidden />}
                </button>
              )
            })}
          </div>
          {/* Not a <form>: the picker usually sits inside one. */}
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
            <span className="size-8 shrink-0 rounded-full ring-1 ring-white/20" style={{ backgroundColor: isHex(typed) ? typed : current }} aria-hidden />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.trim().slice(0, 7))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  applyTyped()
                }
              }}
              aria-label="Hex colour"
              placeholder="#1f4fa8"
              className="h-9 min-w-0 flex-1 rounded-full border border-white/12 bg-black/50 px-3 font-mono text-xs text-king-white focus-visible:border-king-bright-red focus-visible:outline-none"
            />
            <button type="button" onClick={applyTyped} disabled={!isHex(typed)} className="h-9 shrink-0 rounded-full bg-king-red px-3 text-xs font-medium text-king-white hover:bg-king-bright-red disabled:opacity-40">
              Use
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

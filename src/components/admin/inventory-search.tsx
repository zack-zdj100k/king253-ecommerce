"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { btnOutline, inputClass } from "@/components/admin/ui"

/**
 * Inventory search: results update while typing (and on Enter / the button).
 * A search looks through every stock level, not only the filter that is open.
 */
export function InventorySearch({ initial }: { initial: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = React.useState(initial)
  const first = React.useRef(true)

  const go = React.useCallback(
    (value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value.trim()) next.set("q", value.trim())
      else next.delete("q")
      next.delete("page")
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [params, pathname, router]
  )

  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = window.setTimeout(() => go(q), 350)
    return () => window.clearTimeout(t)
  }, [q, go])

  return (
    <form
      role="search"
      className="ml-auto flex w-full gap-2 sm:w-auto"
      onSubmit={(e) => {
        e.preventDefault()
        go(q)
      }}
    >
      <span className="relative block flex-1 sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-king-gray" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Product name, SKU or barcode"
          aria-label="Search inventory"
          className={`${inputClass} pr-9 pl-9`}
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-king-gray hover:text-king-white">
            <X className="size-4" />
          </button>
        )}
      </span>
      <button type="submit" className={btnOutline}>
        Search
      </button>
    </form>
  )
}

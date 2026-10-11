"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Search } from "lucide-react"

import { formatDA } from "@/lib/money"
import { DEFAULT_CATEGORIES } from "@/lib/products"
import { searchAction } from "@/app/actions/shop"
import type { ProductCardData } from "@/server/catalog"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ProductImage } from "@/components/shop/product-image"

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<ProductCardData[]>([])
  const [loading, setLoading] = React.useState(false)
  const router = useRouter()

  // Debounced database search.
  React.useEffect(() => {
    const q = query.trim()
    if (!q) return
    let alive = true
    const id = window.setTimeout(async () => {
      setLoading(true)
      const found = await searchAction(q)
      if (alive) {
        setResults(found)
        setLoading(false)
      }
    }, 220)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [query])

  const close = () => {
    onOpenChange(false)
    setQuery("")
    setResults([])
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        showCloseButton={false}
        className="top-[12svh] w-[calc(100%-2rem)] max-w-2xl translate-y-0 gap-0 border-white/10 bg-king-near-black p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">Search KING 253</DialogTitle>
        <DialogDescription className="sr-only">Search the collection by product or category.</DialogDescription>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (!query.trim()) return
            router.push(`/clothes?q=${encodeURIComponent(query.trim())}#catalog`)
            close()
          }}
          className="flex items-center gap-3 border-b border-white/10 px-5"
        >
          {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-king-gray" aria-hidden /> : <Search className="size-4 shrink-0 text-king-gray" aria-hidden />}
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hoodies, jackets, denim…"
            aria-label="Search products"
            className="h-16 rounded-none border-0 bg-transparent px-0 text-base text-king-white shadow-none placeholder:text-king-gray focus-visible:ring-0 dark:bg-transparent"
          />
          <kbd className="king-label hidden text-[0.6rem] text-king-gray sm:block">Esc</kbd>
        </form>

        <div className="max-h-[60svh] overflow-y-auto p-5" data-lenis-prevent>
          {query.trim() === "" ? (
            <>
              <p className="king-label text-king-gray">Shop by category</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {DEFAULT_CATEGORIES.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/clothes?category=${c.slug}#catalog`}
                      onClick={close}
                      className="king-label inline-flex h-10 items-center border border-white/15 px-4 text-king-muted transition-colors hover:border-king-bright-red hover:text-king-white"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : results.length === 0 && !loading ? (
            <p className="py-6 text-sm text-king-gray">No pieces match &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {results.map((p) => (
                <li key={p.id}>
                  <Link href={`/product/${p.slug}`} onClick={close} className="group flex items-center gap-4 py-3">
                    <span className="relative aspect-[4/5] w-12 shrink-0 overflow-hidden bg-king-card">
                      <ProductImage image={p.image} sizes="160px" alt="" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-king-white uppercase">{p.name}</span>
                      <span className="king-label mt-1 block text-[0.6rem] text-king-gray">
                        {p.categoryName} · {formatDA(p.price)}
                        {p.available <= 0 ? " · Out of stock" : ""}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-king-gray transition-all duration-300 group-hover:translate-x-1 group-hover:text-king-bright-red" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

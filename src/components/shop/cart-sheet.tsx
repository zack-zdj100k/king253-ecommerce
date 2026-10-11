"use client"

import Link from "next/link"
import { AlertTriangle, Minus, Plus, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDA } from "@/lib/money"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useShop } from "@/components/providers/shop-provider"
import { ProductImage } from "@/components/shop/product-image"
import { LOW_STOCK_DISPLAY } from "@/components/shop/stock"

const ISSUE_TEXT = {
  unavailable: "No longer available — remove it to continue.",
  out_of_stock: "Out of stock — remove it to continue.",
  not_enough: (n: number) => `Only ${n} left — lower the quantity.`,
}

export function CartSheet() {
  const { cart, cartReady, cartOpen, setCartOpen, setQuantity, removeFromCart, pending } = useShop()
  const { lines, count, subtotal, hasIssues } = cart

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent
        side="right"
        data-lenis-prevent
        className="gap-0 border-white/10 bg-king-near-black p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-white/10 px-6 py-6">
          <SheetTitle className="king-label text-king-white">Your bag ({count})</SheetTitle>
          <SheetDescription className="sr-only">Items you have added to your bag. Adding to the bag does not hold stock.</SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-6 px-6">
            <p className="king-display text-5xl text-king-white">
              {cartReady ? (
                <>
                  Empty
                  <br />
                  for now.
                </>
              ) : (
                "Loading…"
              )}
            </p>
            <p className="text-sm text-king-gray">Nothing in your bag yet. The collection is waiting.</p>
            <Button asChild variant="king" size="xl" onClick={() => setCartOpen(false)}>
              <Link href="/clothes">Shop the collection</Link>
            </Button>
          </div>
        ) : (
          <ul className={cn("flex-1 overflow-y-auto px-6 transition-opacity", pending && "opacity-70")} aria-label="Bag items">
            {lines.map((line) => (
              <li key={line.variantId} className="flex gap-4 border-b border-white/5 py-5">
                <Link
                  href={`/product/${line.slug}`}
                  onClick={() => setCartOpen(false)}
                  className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden bg-king-card"
                >
                  <ProductImage image={line.image} alt={line.name} sizes="200px" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium tracking-tight text-king-white uppercase">{line.name}</p>
                      <p className="king-label mt-1 text-[0.6rem] text-king-gray">
                        {line.color} / {line.size}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(line.variantId)}
                      aria-label={`Remove ${line.name} (${line.size})`}
                      className="-m-2 grid size-9 place-items-center text-king-gray transition-colors hover:text-king-white"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {line.issue ? (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-king-bright-red">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {line.issue === "not_enough" ? ISSUE_TEXT.not_enough(line.available) : ISSUE_TEXT[line.issue]}
                    </p>
                  ) : line.available <= LOW_STOCK_DISPLAY ? (
                    <p className="king-label mt-2 text-[0.55rem] text-king-muted">Available — {line.available} left</p>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center border border-white/15">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                        aria-label={`Decrease quantity of ${line.name}`}
                        className="grid size-9 place-items-center text-king-muted hover:text-king-white"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                        disabled={line.quantity >= line.available}
                        aria-label={`Increase quantity of ${line.name}`}
                        className="grid size-9 place-items-center text-king-muted hover:text-king-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <p className="king-label text-[0.6rem] text-king-muted">{formatDA(line.lineTotal)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <SheetFooter className="gap-4 border-t border-white/10 bg-king-black px-6 py-6">
            <div className="flex items-center justify-between">
              <span className="king-label text-king-gray">Subtotal</span>
              <span className="king-label text-king-white">{formatDA(subtotal)}</span>
            </div>
            <p className="text-xs text-king-gray">Delivery is calculated at checkout. Pay cash on delivery.</p>
            <Separator className="bg-white/10" />
            {hasIssues ? (
              <Button variant="king" size="xl" className="w-full" disabled>
                Fix your bag to continue
              </Button>
            ) : (
              <Button asChild variant="king" size="xl" className="w-full" onClick={() => setCartOpen(false)}>
                <Link href="/checkout">Buy all — {count} {count === 1 ? "item" : "items"}</Link>
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

"use client"

import { useTranslations } from "next-intl"
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


export function CartSheet() {
  const t = useTranslations("cart")
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
          <SheetTitle className="king-label text-king-white">{t("title", { count })}</SheetTitle>
          <SheetDescription className="sr-only">{t("help")}</SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-6 px-6">
            <p className="king-display text-5xl text-king-white">
              {cartReady ? (
                <>
                  {t("empty1")}
                  <br />
                  {t("empty2")}
                </>
              ) : (
                t("loading")
              )}
            </p>
            <p className="text-sm text-king-gray">{t("emptyText")}</p>
            <Button asChild variant="king" size="xl" onClick={() => setCartOpen(false)}>
              <Link href="/clothes">{t("shop")}</Link>
            </Button>
          </div>
        ) : (
          <ul className={cn("flex-1 overflow-y-auto px-6 transition-opacity", pending && "opacity-70")} aria-label={t("items")}>
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
                      <p className="king-label mt-1 text-[0.625rem] text-king-gray">
                        {line.color} / {line.size}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(line.variantId)}
                      aria-label={t("remove", { name: line.name, size: line.size })}
                      className="-m-2 grid size-9 place-items-center text-king-gray transition-colors hover:text-king-white"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {line.issue ? (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-king-bright-red">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {line.issue === "not_enough" ? t("notEnough", { count: line.available }) : line.issue === "unavailable" ? t("unavailable") : t("outOfStock")}
                    </p>
                  ) : line.available <= LOW_STOCK_DISPLAY ? (
                    <p className="king-label mt-2 text-[0.625rem] text-king-muted">{t("left", { count: line.available })}</p>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center border border-white/15">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                        aria-label={t("decrease", { name: line.name })}
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
                        aria-label={t("increase", { name: line.name })}
                        className="grid size-9 place-items-center text-king-muted hover:text-king-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <p className="king-label text-[0.625rem] text-king-muted">{formatDA(line.lineTotal)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <SheetFooter className="gap-4 border-t border-white/10 bg-king-black px-6 py-6">
            <div className="flex items-center justify-between">
              <span className="king-label text-king-gray">{t("subtotal")}</span>
              <span className="king-label text-king-white">{formatDA(subtotal)}</span>
            </div>
            <p className="text-xs text-king-gray">{t("deliveryNote")}</p>
            <Separator className="bg-white/10" />
            {hasIssues ? (
              <Button variant="king" size="xl" className="w-full" disabled>
                {t("fix")}
              </Button>
            ) : (
              <Button asChild variant="king" size="xl" className="w-full" onClick={() => setCartOpen(false)}>
                <Link href="/checkout">{t("buyAll", { count })}</Link>
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

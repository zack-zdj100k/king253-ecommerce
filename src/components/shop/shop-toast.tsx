"use client"

import { CheckCircle2, CircleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { useShop } from "@/components/providers/shop-provider"

/** Small status message for bag/wishlist actions and stock errors. */
export function ShopToast() {
  const { notice } = useShop()
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex max-w-md animate-in items-center gap-3 border bg-king-black/95 px-4 py-3 text-sm text-king-white shadow-2xl backdrop-blur fade-in-0 slide-in-from-bottom-2",
            notice.tone === "error" ? "border-king-red-line" : "border-white/15"
          )}
        >
          {notice.tone === "error" ? (
            <CircleAlert className="size-4 shrink-0 text-king-bright-red" aria-hidden />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-king-white" aria-hidden />
          )}
          {notice.text}
        </p>
      )}
    </div>
  )
}

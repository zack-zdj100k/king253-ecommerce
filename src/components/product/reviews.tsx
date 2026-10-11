"use client"

import * as React from "react"
import { BadgeCheck, Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { submitReviewAction } from "@/app/actions/reviews"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Review = { id: string; authorName: string; rating: number; body: string; verifiedPurchase: boolean; createdAt: Date }

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3.5", n <= Math.round(value) ? "fill-king-bright-red text-king-bright-red" : "text-white/25")} aria-hidden />
      ))}
    </span>
  )
}

export function ReviewsSection({
  productId,
  rating,
  reviews,
}: {
  productId: string
  rating: { average: number | null; total: number; distribution: { stars: number; count: number }[] }
  reviews: Review[]
}) {
  return (
    <section aria-labelledby="reviews-title" className="border-t border-white/10 pt-16">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <h2 id="reviews-title" className="king-display text-[clamp(2.25rem,4vw,3.75rem)] text-king-white">
            Reviews
          </h2>
          {rating.total > 0 ? (
            <div className="mt-6">
              <p className="flex items-end gap-3">
                <span className="text-5xl font-semibold tracking-tight text-king-white">{rating.average?.toFixed(1)}</span>
                <span className="pb-2">
                  <Stars value={rating.average ?? 0} />
                  <span className="king-label mt-1 block text-[0.6rem] text-king-gray">
                    {rating.total} {rating.total === 1 ? "review" : "reviews"}
                  </span>
                </span>
              </p>
              <ul className="mt-6 space-y-2" aria-label="Rating distribution">
                {rating.distribution.map((d) => (
                  <li key={d.stars} className="flex items-center gap-3 text-xs text-king-gray">
                    <span className="w-6">{d.stars}★</span>
                    <span className="h-1.5 flex-1 bg-white/10">
                      <span className="block h-full bg-king-bright-red" style={{ width: `${rating.total ? (d.count / rating.total) * 100 : 0}%` }} />
                    </span>
                    <span className="w-6 text-right tabular-nums">{d.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-king-gray">No reviews yet. Bought this piece? Be the first to say how it wears.</p>
          )}
          <ReviewForm productId={productId} />
        </div>

        <ul className="space-y-6">
          {reviews.map((r) => (
            <li key={r.id} className="border-b border-white/10 pb-6">
              <div className="flex flex-wrap items-center gap-3">
                <Stars value={r.rating} />
                <span className="text-sm font-semibold text-king-white uppercase">{r.authorName}</span>
                {r.verifiedPurchase && (
                  <span className="king-label inline-flex items-center gap-1 text-[0.55rem] text-king-bright-red">
                    <BadgeCheck className="size-3.5" aria-hidden /> Verified purchase
                  </span>
                )}
                <span className="text-xs text-king-gray">{new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-king-muted">{r.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ReviewForm({ productId }: { productId: string }) {
  const [open, setOpen] = React.useState(false)
  const [rating, setRating] = React.useState(0)
  const [state, setState] = React.useState<{ status: "idle" | "sending" | "done" | "error"; message?: string }>({ status: "idle" })

  if (state.status === "done") {
    return <p className="mt-8 border border-white/10 p-5 text-sm text-king-muted" role="status">{state.message}</p>
  }
  if (!open) {
    return (
      <Button variant="kingOutline" size="xl" className="mt-8" onClick={() => setOpen(true)}>
        Write a review
      </Button>
    )
  }
  return (
    <form
      className="mt-8 space-y-4 border border-white/10 p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!rating) return setState({ status: "error", message: "Choose a star rating." })
        const fd = new FormData(e.currentTarget)
        setState({ status: "sending" })
        const r = await submitReviewAction({
          productId,
          rating,
          authorName: String(fd.get("name") ?? ""),
          body: String(fd.get("body") ?? ""),
          orderNumber: String(fd.get("order") ?? "") || undefined,
          phone: String(fd.get("phone") ?? "") || undefined,
        })
        setState(
          r.ok
            ? { status: "done", message: `Thanks — your review will appear once approved.${r.verified ? " It's marked as a verified purchase." : ""}` }
            : { status: "error", message: r.error }
        )
      }}
    >
      <fieldset>
        <legend className="king-label mb-2 text-[0.6rem] text-king-gray">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={rating === n} className="p-1">
              <Star className={cn("size-6", n <= rating ? "fill-king-bright-red text-king-bright-red" : "text-white/30")} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="review-name" className="text-sm text-king-white">Name</Label>
        <Input id="review-name" name="name" required minLength={2} maxLength={60} className="h-11 rounded-[4px] border-white/15 bg-black/40 dark:bg-black/40" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="review-body" className="text-sm text-king-white">Review</Label>
        <textarea id="review-body" name="body" required minLength={10} maxLength={2000} rows={4} className="w-full rounded-[4px] border border-white/15 bg-black/40 p-3 text-sm text-king-white focus-visible:border-king-bright-red focus-visible:outline-none" />
      </div>
      <details className="text-sm text-king-gray">
        <summary className="cursor-pointer">Bought it? Add your order number to mark it verified</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input name="order" placeholder="KING253-…" aria-label="Order number" className="h-11 rounded-[4px] border-white/15 bg-black/40 dark:bg-black/40" />
          <Input name="phone" placeholder="Phone used for the order" aria-label="Phone used for the order" inputMode="tel" className="h-11 rounded-[4px] border-white/15 bg-black/40 dark:bg-black/40" />
        </div>
      </details>
      {state.status === "error" && <p className="text-sm text-king-bright-red" role="alert">{state.message}</p>}
      <Button type="submit" variant="king" size="xl" disabled={state.status === "sending"}>
        {state.status === "sending" ? "Sending…" : "Submit review"}
      </Button>
    </form>
  )
}

import type { Metadata } from "next"

import { TrackOrder } from "@/components/orders/track-order"
import { BackButton } from "@/components/ui/back-button"

export const metadata: Metadata = {
  title: "Track your order",
  description: "Follow your KING 253 order with your order number and phone.",
  alternates: { canonical: "/track" },
}

export default async function TrackPage({ searchParams }: PageProps<"/track">) {
  const { number } = await searchParams
  return (
    <section className="relative min-h-[80svh] bg-king-black pt-28 pb-24">
      <div aria-hidden className="pointer-events-none absolute top-0 right-0 h-[50svh] w-2/3 bg-[radial-gradient(ellipse_at_80%_0%,rgba(163,13,13,0.22),transparent_60%)]" />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <BackButton fallback="/" className="mb-4" />
        <p className="king-label text-[0.6rem] text-king-gray">[ Order tracking ]</p>
        <h1 className="king-display mt-4 text-[clamp(2.75rem,7vw,6rem)] text-king-white">Where&apos;s my order?</h1>
        <p className="mt-4 max-w-lg text-sm text-king-muted">Enter your order number and the phone number you ordered with. No account needed.</p>
        <div className="mt-12">
          <TrackOrder initialNumber={typeof number === "string" ? number.slice(0, 40) : ""} />
        </div>
      </div>
    </section>
  )
}

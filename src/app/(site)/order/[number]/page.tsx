import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { db } from "@/server/db"
import { findOrderByToken } from "@/server/orders/view"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"
import { OrderSummary } from "@/components/orders/order-summary"
import { OrderTimeline } from "@/components/orders/order-timeline"
import { CancelOrder } from "@/components/orders/cancel-order"
import { OrderReturns } from "@/components/orders/order-returns"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("order"))("metaTitle"), robots: { index: false } }
}
export const dynamic = "force-dynamic"

export default async function OrderConfirmationPage({ params, searchParams }: PageProps<"/order/[number]">) {
  const t = await getTranslations("order")
  const { number } = await params
  const { t: token } = await searchParams
  if (typeof token !== "string") notFound()
  const order = await findOrderByToken(db, decodeURIComponent(number), token)
  if (!order) notFound()

  return (
    <section className="relative bg-king-black pt-28 pb-24">
      <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 h-[50svh] w-full -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(163,13,13,0.3),transparent_60%)]" />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <BackButton fallback="/account" className="mb-4" />
        {order.status === "cancelled" ? (
          <>
            <p className="king-label text-[0.6rem] text-king-gray">{t("cancelledEyebrow")}</p>
            <h1 className="king-display mt-4 text-[clamp(2.75rem,7vw,6rem)] text-king-white">{t("orderNo", { number: order.number })}</h1>
            <p className="mt-5 max-w-xl text-base text-king-muted">{t("cancelledText")}</p>
          </>
        ) : order.returned ? (
          <>
            <p className="king-label text-[0.6rem] text-king-gray">{t("returnedEyebrow")}</p>
            <h1 className="king-display mt-4 text-[clamp(2.75rem,7vw,6rem)] text-king-white">{t("orderNo", { number: order.number })}</h1>
            <p className="mt-5 max-w-xl text-base text-king-muted">{t("returnedText")}</p>
          </>
        ) : (
          <>
            <p className="king-label text-[0.6rem] text-king-bright-red">{order.status === "delivered" ? t("delivered") : t("received")}</p>
            <h1 className="king-display mt-4 text-[clamp(2.75rem,7vw,6rem)] text-king-white">{t("thanks", { name: order.customerName.split(" ")[0] })}</h1>
            <p className="mt-5 max-w-xl text-base text-king-muted">
              {t(order.status === "delivered" ? "deliveredText" : order.status === "pending" || order.status === "contacting" ? "pendingText" : "confirmedText", {
                number: order.number,
              })}
            </p>
          </>
        )}
        <div className="mt-12 space-y-12">
          <OrderTimeline order={order} />
          <div className="border-t border-white/10 pt-10">
            <OrderSummary order={order} />
          </div>
          <OrderReturns order={order} />
          <CancelOrder order={order} token={token} />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="king" size="xl">
              <Link href={`/track?number=${encodeURIComponent(order.number)}`}>{t("trackThis")}</Link>
            </Button>
            <Button asChild variant="kingOutline" size="xl">
              <Link href="/clothes">{t("keepShopping")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

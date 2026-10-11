import type { Metadata } from "next"
import Link from "next/link"
import { desc, eq } from "drizzle-orm"
import { after } from "next/server"
import { redirect } from "next/navigation"

import { formatPhone } from "@/lib/phone"
import { findCommune, findWilaya } from "@/lib/algeria"
import { getAccount } from "@/server/account"
import { db } from "@/server/db"
import { orders } from "@/server/db/schema"
import { getCurrentUser } from "@/server/auth/session"
import { BackButton } from "@/components/ui/back-button"
import { getCartLines, getCheckoutProfile, getVariantLine, markCheckoutStarted } from "@/server/cart"
import { recordEvent } from "@/server/analytics"
import { getSettings } from "@/server/settings"
import { readCartId, readProfileId, readSessionId } from "@/server/request"
import { Button } from "@/components/ui/button"
import { CheckoutForm, type CheckoutPrefill } from "@/components/checkout/checkout-form"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f-]{36}$/i

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const p = await searchParams

  // Ordering needs an account: send visitors to create one (or sign in), then straight back here.
  if (!(await getCurrentUser())) {
    const back = new URLSearchParams()
    for (const [k, v] of Object.entries(p)) if (typeof v === "string") back.set(k, v)
    const next = `/checkout${back.size ? `?${back}` : ""}`
    redirect(`/sign-up?next=${encodeURIComponent(next)}`)
  }
  const buy = typeof p.buy === "string" && UUID.test(p.buy) ? p.buy : null
  const qty = Math.min(Math.max(Number.parseInt(typeof p.qty === "string" ? p.qty : "1", 10) || 1, 1), 20)
  const mode = buy ? "buy_now" : "cart"

  const cartId = mode === "cart" ? await readCartId() : null
  const lines = buy ? [await getVariantLine(db, buy, qty)].filter((l) => l !== null) : cartId ? await getCartLines(db, cartId) : []

  if (!lines.length) {
    return (
      <section className="flex min-h-[70svh] flex-col items-center justify-center bg-king-black px-4 pt-24 text-center">
        <h1 className="king-display text-[clamp(3rem,8vw,6rem)] text-king-white">Nothing to check out.</h1>
        <p className="mt-4 text-sm text-king-gray">Your bag is empty or this piece is no longer available.</p>
        <Button asChild variant="king" size="xl" className="mt-10">
          <Link href="/clothes">Shop the collection</Link>
        </Button>
      </section>
    )
  }

  // Reuse details: saved checkout session first, then the signed-in customer's last order.
  const [settings, user, profileId, sessionId] = await Promise.all([getSettings(db), getCurrentUser(), readProfileId(), readSessionId()])
  const profile = profileId ? await getCheckoutProfile(db, profileId) : null
  const lastOrder =
    !profile && user
      ? (await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(1))[0]
      : null

  // Signed-in customers: details saved on their account page come first.
  const account = user ? await getAccount(db, user.id) : null
  const accountAddress = account?.wilaya && account.city ? account : null
  // Only reuse a saved wilaya/commune that exists on the official map.
  const savedWilaya = findWilaya(accountAddress?.wilaya ?? profile?.wilaya ?? lastOrder?.wilayaName)
  const savedPhone = account?.phone ?? profile?.phone ?? lastOrder?.customerPhone ?? null
  const prefill: CheckoutPrefill = {
    fullName: account?.name ?? profile?.fullName ?? lastOrder?.customerName ?? "",
    age: String(profile?.age ?? lastOrder?.customerAge ?? ""),
    phone: savedPhone ? formatPhone(savedPhone) : "",
    email: profile?.email ?? lastOrder?.customerEmail ?? user?.email ?? "",
    wilaya: savedWilaya?.fr ?? "",
    city: savedWilaya ? (findCommune(savedWilaya, accountAddress?.city ?? profile?.city ?? lastOrder?.city) ?? "") : "",
    address: accountAddress?.address ?? profile?.address ?? lastOrder?.address ?? "",
    notes: "",
  }
  const returning = Boolean(prefill.fullName && prefill.phone && prefill.wilaya && prefill.city && prefill.address && prefill.age)

  after(async () => {
    if (cartId) await markCheckoutStarted(db, cartId)
    await recordEvent(db, { type: "checkout_start", sessionId, productId: lines[0]?.productId })
  })

  return (
    <section className="relative bg-king-black pt-28 pb-24">
      <div aria-hidden className="pointer-events-none absolute top-0 left-0 h-[50svh] w-full bg-[radial-gradient(ellipse_at_20%_0%,rgba(163,13,13,0.22),transparent_60%)]" />
      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <BackButton fallback="/clothes" className="mb-4" />
        <p className="king-label text-[0.6rem] text-king-gray">[ Checkout ] · Cash on delivery</p>
        <h1 className="king-display mt-4 text-[clamp(2.75rem,6vw,5.5rem)] text-king-white">{mode === "buy_now" ? "Buy now." : "Buy all."}</h1>
        <div className="mt-12">
          <CheckoutForm mode={mode} lines={lines} delivery={{ fee: settings.deliveryFee, estimate: settings.deliveryEstimate, freeDelivery: settings.freeDelivery, freeDeliveryMin: settings.freeDeliveryMin }} prefill={prefill} returning={returning} />
        </div>
      </div>
    </section>
  )
}

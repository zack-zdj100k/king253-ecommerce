"use client"

import { useLocale, useTranslations } from "next-intl"

import { useErrorText } from "@/i18n/errors"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { trackOrderAction, type TrackResult } from "@/app/actions/orders"
import type { CustomerOrderView } from "@/server/orders/view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OrderSummary } from "@/components/orders/order-summary"
import { OrderTimeline } from "@/components/orders/order-timeline"
import { CancelOrder } from "@/components/orders/cancel-order"
import { OrderReturns } from "@/components/orders/order-returns"

const fieldClass =
  "h-12 rounded-[6px] border-white/12 bg-black/40 px-4 text-base text-king-white placeholder:text-king-gray/70 focus-visible:border-king-bright-red focus-visible:ring-2 focus-visible:ring-king-bright-red/25 md:text-sm dark:bg-black/40"

export function TrackOrder({ initialNumber }: { initialNumber: string }) {
  const t = useTranslations("order")
  const et = useErrorText()
  const [number, setNumber] = React.useState(initialNumber)
  const [phone, setPhone] = React.useState("")
  const [result, setResult] = React.useState<TrackResult | null>(null)
  const [pending, startTransition] = React.useTransition()

  return (
    <div className="space-y-12">
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          startTransition(async () => setResult(await trackOrderAction({ number, phone })))
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="track-number" className="text-sm text-king-white">{t("number")}</Label>
          <Input id="track-number" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="KING253-20261004-001" required className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="track-phone" className="text-sm text-king-white">{t("phoneUsed")}</Label>
          <Input id="track-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="05 / 06 / 07 …" required className={fieldClass} />
        </div>
        <Button type="submit" variant="king" size="xl" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t("track")}
        </Button>
      </form>

      {result && !result.ok && (
        <p role="alert" className="border border-king-red-line bg-king-red/10 p-4 text-sm text-king-white">
          {et(result.error)}
        </p>
      )}

      {result?.ok && <TrackedOrder order={result.order} phone={result.phone} onUpdate={setResult} />}
    </div>
  )
}

function TrackedOrder({ order, phone, onUpdate }: { order: CustomerOrderView; phone: string; onUpdate: (r: TrackResult) => void }) {
  const t = useTranslations("order")
  const locale = useLocale()
  return (
    <div className="space-y-12">
      <div>
        <p className="king-label text-[0.625rem] text-king-gray">{t("order")}</p>
        <p className="king-display mt-2 text-4xl text-king-white">{order.number}</p>
        <p className="mt-2 text-sm text-king-gray">{t("placed", { date: new Date(order.createdAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) })}</p>
      </div>
      <OrderTimeline order={order} />
      <div className="border-t border-white/10 pt-10">
        <OrderSummary order={order} />
      </div>

      <OrderReturns order={order} />

      {order.status === "delivered" && !order.returned && (
        <p className="border-t border-white/10 pt-10 text-sm text-king-gray">
          {t("returnHelp")}
        </p>
      )}

      {order.status !== "delivered" && (
        <div className="border-t border-white/10 pt-10">
          <CancelOrder order={order} phone={phone} onCancelled={(o) => onUpdate({ ok: true, order: o, phone })} />
        </div>
      )}
    </div>
  )
}


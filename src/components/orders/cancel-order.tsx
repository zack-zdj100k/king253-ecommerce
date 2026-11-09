"use client"

import { useTranslations } from "next-intl"

import { useErrorText } from "@/i18n/errors"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"

import { cancelOrderAction } from "@/app/actions/orders"
import type { CustomerOrderView } from "@/server/orders/view"
import { Button } from "@/components/ui/button"

const REASONS = ["r1", "r2", "r3", "r4", "r5"] as const

/**
 * Lets the customer cancel while the order is not yet being prepared.
 * Proof of ownership is the order's secret link (`token`) or the order phone.
 */
export function CancelOrder({
  order,
  token,
  phone,
  onCancelled,
}: {
  order: CustomerOrderView
  token?: string
  phone?: string
  /** Track page: receives the refreshed order. Otherwise the page is refreshed. */
  onCancelled?: (order: CustomerOrderView) => void
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState<(typeof REASONS)[number]>(REASONS[0])
  const [error, setError] = React.useState<string | null>(null)
  const t = useTranslations("order")
  const et = useErrorText()
  const [pending, start] = React.useTransition()

  if (order.status === "cancelled") {
    return (
      <p className="flex items-center gap-2 border border-white/10 p-4 text-sm text-king-muted" role="status">
        <XCircle className="size-4 text-king-gray" aria-hidden /> {t("cancelledShort")}
      </p>
    )
  }
  if (!order.cancellable) {
    return <p className="text-sm text-king-gray">{t("tooLate")}</p>
  }
  if (!open) {
    return (
      <Button type="button" variant="kingOutline" size="xl" onClick={() => setOpen(true)}>
        <XCircle className="size-4" aria-hidden /> {t("cancelThis")}
      </Button>
    )
  }
  return (
    <div className="max-w-xl space-y-4 border border-king-red-line bg-king-red/10 p-5">
      <p className="text-sm font-medium text-king-white">{t("cancelQ", { number: order.number })}</p>
      <label className="block">
        <span className="mb-2 block text-sm text-king-muted">{t("why")}</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
          className="h-12 w-full rounded-[6px] border border-white/12 bg-black/40 px-4 text-sm text-king-white focus-visible:border-king-bright-red focus-visible:outline-none"
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {t(r)}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-sm text-king-bright-red">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="king"
          size="xl"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const r = await cancelOrderAction({ number: order.number, token, phone, reason: t(reason) })
              if (!r.ok) return setError(et(r.error))
              setOpen(false)
              if (onCancelled) onCancelled(r.order)
              else router.refresh()
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {t("yesCancel")}
        </Button>
        <Button type="button" variant="kingOutline" size="xl" onClick={() => setOpen(false)}>
          {t("keep")}
        </Button>
      </div>
    </div>
  )
}

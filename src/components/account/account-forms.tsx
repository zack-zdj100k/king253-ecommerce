"use client"

import { useTranslations } from "next-intl"

import { useErrorText } from "@/i18n/errors"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Loader2, MapPin, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { findCommune, findWilaya, WILAYAS, wilayaLabel } from "@/lib/algeria"
import { changePasswordAction, deleteAccountAction, removeAddressAction, removeCancelledOrderAction, updateDetailsAction, type AccountResult } from "@/app/actions/account"
import { Button } from "@/components/ui/button"

const field =
  "h-12 w-full rounded-[6px] border border-white/12 bg-black/40 px-4 text-base text-king-white placeholder:text-king-gray/70 transition-colors focus-visible:border-king-bright-red focus-visible:ring-2 focus-visible:ring-king-bright-red/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
const label = "mb-2 block text-sm font-medium text-king-white"

function useAccountAction() {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const [result, setResult] = React.useState<AccountResult | null>(null)
  const run = (action: () => Promise<AccountResult>, onOk?: () => void) => {
    setResult(null)
    start(async () => {
      const r = await action()
      setResult(r)
      if (r.ok) {
        onOk?.()
        router.refresh()
      }
    })
  }
  return { pending, result, run }
}

function Message({ result }: { result: AccountResult | null }) {
  const et = useErrorText()
  if (!result) return null
  return result.ok ? (
    <p role="status" className="flex items-center gap-2 text-sm text-emerald-300">
      <Check className="size-4" aria-hidden /> {et(result.message)}
    </p>
  ) : (
    <p role="alert" className="text-sm text-king-bright-red">
      {et(result.error)}
    </p>
  )
}

function Select({ value, onChange, disabled, children, id }: { value: string; onChange: (v: string) => void; disabled?: boolean; children: React.ReactNode; id: string }) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={cn(field, "appearance-none pr-10", !value && "text-king-gray")}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-king-gray" aria-hidden />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* My information                                                     */
/* ------------------------------------------------------------------ */

export type AccountDetails = { name: string; email: string; phone: string; wilaya: string; city: string; address: string }

export function DetailsForm({ initial }: { initial: AccountDetails }) {
  const t = useTranslations("account")
  const { pending, result, run } = useAccountAction()
  const [v, setV] = React.useState(initial)
  const wilaya = findWilaya(v.wilaya)
  const dirty = (["name", "email", "phone", "wilaya", "city", "address"] as const).some((k) => v[k] !== initial[k])

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => updateDetailsAction({ name: v.name, email: v.email, phone: v.phone, wilaya: v.wilaya, city: v.city, address: v.address }))
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="acc-name" className={label}>
            {t("fullName")}
          </label>
          <input id="acc-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" className={field} />
        </div>
        <div>
          <label htmlFor="acc-email" className={label}>
            {t("email")} <span className="font-normal text-king-gray">{t("emailHint")}</span>
          </label>
          <input
            id="acc-email"
            type="email"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            autoComplete="email"
            placeholder="you@example.com"
            className={field}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="acc-phone" className={label}>
            {t("phone")} <span className="font-normal text-king-gray">{t("phoneHint")}</span>
          </label>
          <input id="acc-phone" type="tel" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="05 / 06 / 07 …" autoComplete="tel" className={field} />
        </div>
      </div>

      <fieldset className="space-y-5 border-t border-white/10 pt-6">
        <legend className="king-label flex items-center gap-2 text-[0.625rem] text-king-gray">
          <MapPin className="size-3.5 text-king-bright-red" aria-hidden /> {t("deliveryAddress")}
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="acc-wilaya" className={label}>
              {t("wilaya")}
            </label>
            <Select
              id="acc-wilaya"
              value={wilaya?.fr ?? ""}
              onChange={(fr) => {
                const next = findWilaya(fr)
                setV({ ...v, wilaya: fr, city: next && findCommune(next, v.city) ? v.city : "" })
              }}
            >
              <option value="">{t("chooseWilaya")}</option>
              {WILAYAS.map((w) => (
                <option key={w.code} value={w.fr}>
                  {wilayaLabel(w)} · {w.ar}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="acc-city" className={label}>
              {t("commune")}
            </label>
            <Select id="acc-city" value={wilaya ? (findCommune(wilaya, v.city) ?? "") : ""} onChange={(city) => setV({ ...v, city })} disabled={!wilaya}>
              <option value="">{wilaya ? t("chooseCommune") : t("chooseWilayaFirst")}</option>
              {wilaya?.communes.map(([fr, ar]) => (
                <option key={fr} value={fr}>
                  {fr} · {ar}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="acc-address" className={label}>
              {t("address")}
            </label>
            <input id="acc-address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} autoComplete="street-address" className={field} />
          </div>
        </div>
        <p className="text-xs text-king-gray">{t("savedNote")}</p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="king" size="xl" disabled={pending || !dirty}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {t("save")}
        </Button>
        {(initial.wilaya || initial.address) && <RemoveAddress />}
        <Message result={result} />
      </div>
    </form>
  )
}

function RemoveAddress() {
  const t = useTranslations("account")
  const { pending, result, run } = useAccountAction()
  const [asking, setAsking] = React.useState(false)
  if (!asking) {
    return (
      <Button type="button" variant="kingOutline" size="xl" onClick={() => setAsking(true)}>
        <Trash2 className="size-4" aria-hidden /> {t("removeAddress")}
      </Button>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm text-king-white">{t("removeAddressQ")}</span>
      <Button type="button" variant="king" size="lg" disabled={pending} onClick={() => run(removeAddressAction, () => setAsking(false))}>
        {t("yesRemove")}
      </Button>
      <Button type="button" variant="kingOutline" size="lg" onClick={() => setAsking(false)}>
        {t("cancel")}
      </Button>
      <Message result={result} />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Security                                                           */
/* ------------------------------------------------------------------ */

export function PasswordForm() {
  const t = useTranslations("account")
  const { pending, result, run } = useAccountAction()
  const [v, setV] = React.useState({ current: "", next: "", repeat: "" })
  const mismatch = v.repeat !== "" && v.next !== v.repeat
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (mismatch) return
        run(() => changePasswordAction(v.current, v.next), () => setV({ current: "", next: "", repeat: "" }))
      }}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        {(
          [
            ["current", t("currentPassword"), "current-password"],
            ["next", t("newPassword"), "new-password"],
            ["repeat", t("repeatPassword"), "new-password"],
          ] as const
        ).map(([key, text, auto]) => (
          <div key={key}>
            <label htmlFor={`pw-${key}`} className={label}>
              {text}
            </label>
            <input id={`pw-${key}`} type="password" value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} autoComplete={auto} className={field} />
          </div>
        ))}
      </div>
      <p className="text-xs text-king-gray">{t("passwordRule")}</p>
      {mismatch && <p className="text-sm text-king-bright-red">{t("mismatch")}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="king" size="xl" disabled={pending || !v.current || !v.next || mismatch}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {t("changePassword")}
        </Button>
        <Message result={result} />
      </div>
    </form>
  )
}

export function DeleteAccount() {
  const t = useTranslations("account")
  const { pending, result, run } = useAccountAction()
  const [open, setOpen] = React.useState(false)
  const [password, setPassword] = React.useState("")
  if (!open) {
    return (
      <Button type="button" variant="kingOutline" size="xl" onClick={() => setOpen(true)} className="border-king-red-line text-king-bright-red hover:bg-king-red hover:text-king-white">
        <Trash2 className="size-4" aria-hidden /> {t("deleteMine")}
      </Button>
    )
  }
  return (
    <form
      className="space-y-4 border border-king-red-line bg-king-red/10 p-5"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => deleteAccountAction(password))
      }}
    >
      <p className="text-sm leading-relaxed text-king-white">
        {t("deleteWarning")}
      </p>
      <div className="max-w-sm">
        <label htmlFor="del-password" className={label}>
          {t("confirmPassword")}
        </label>
        <input id="del-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={field} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="king" size="xl" disabled={pending || !password}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {t("deleteForever")}
        </Button>
        <Button type="button" variant="kingOutline" size="xl" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
        <Message result={result} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* My orders                                                          */
/* ------------------------------------------------------------------ */

/** Hides a cancelled or returned order from "My orders" (the shop keeps it). */
export function RemoveFromMyOrders({ orderId, kind }: { orderId: string; kind: "cancelled" | "returned" }) {
  const t = useTranslations("account")
  const { pending, result, run } = useAccountAction()
  const [asking, setAsking] = React.useState(false)
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {result && !result.ok && <Message result={result} />}
      {!asking ? (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="king-label inline-flex h-9 items-center gap-2 px-3 text-[0.625rem] text-king-gray transition-colors hover:text-king-bright-red"
        >
          <Trash2 className="size-3.5" aria-hidden /> {t("removeFromOrders")}
        </button>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-xs text-king-white">{t(kind === "cancelled" ? "removeOrderQ_cancelled" : "removeOrderQ_returned")}</span>
          <Button type="button" variant="king" size="lg" disabled={pending} onClick={() => run(() => removeCancelledOrderAction(orderId))}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} {t("yesRemove")}
          </Button>
          <Button type="button" variant="kingOutline" size="lg" onClick={() => setAsking(false)}>
            {t("cancel")}
          </Button>
        </span>
      )}
    </div>
  )
}

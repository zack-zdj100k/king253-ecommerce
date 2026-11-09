"use client"

import { useTranslations } from "next-intl"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Banknote, Building2, Check, ChevronDown, Home, Loader2, MapPin, Pencil, Store } from "lucide-react"

import { cn } from "@/lib/utils"
import { findCommune, findWilaya, WILAYAS, wilayaLabel } from "@/lib/algeria"
import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { placeOrderAction, quoteCheckoutAction, saveCheckoutDraftAction, type CheckoutQuote } from "@/app/actions/checkout"
import { REFERRAL_SOURCES } from "@/lib/referral"
import { useErrorText } from "@/i18n/errors"
import type { CartLine } from "@/server/cart"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useShop } from "@/components/providers/shop-provider"
import { ProductImage } from "@/components/shop/product-image"

export type CheckoutPrefill = {
  fullName: string
  phone: string
  email: string
  wilaya: string
  city: string
  address: string
  notes: string
}

const fieldClass =
  "h-12 rounded-[6px] border-white/12 bg-black/40 px-4 text-base text-king-white placeholder:text-king-gray/70 focus-visible:border-king-bright-red focus-visible:ring-2 focus-visible:ring-king-bright-red/25 md:text-sm dark:bg-black/40"

export function CheckoutForm({
  mode,
  lines,
  delivery,
  prefill,
  returning,
  account,
}: {
  mode: "buy_now" | "cart"
  lines: CartLine[]
  /** Delivery prices come per shop from the server; the shop pays it when the promotion applies. */
  delivery: { estimate: string; freeDelivery: boolean; freeDeliveryMin: number }
  prefill: CheckoutPrefill
  /** True when details were saved from a previous checkout — show them as a summary. */
  returning: boolean
  /** Guests set a password (their account is created by phone); everyone answers the referral once. */
  account: { signedIn: boolean; needsReferral: boolean }
}) {
  const t = useTranslations("checkout")
  const tr = useTranslations("referral")
  const et = useErrorText()
  const router = useRouter()
  const { refreshCart } = useShop()
  const [values, setValues] = React.useState<CheckoutPrefill>(prefill)
  const [editing, setEditing] = React.useState(!returning)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  // One key per checkout attempt: retries/double clicks return the same order.
  const [idempotencyKey] = React.useState(() => crypto.randomUUID() + crypto.randomUUID())
  const draftTimer = React.useRef<number | null>(null)

  const selectedWilaya = findWilaya(values.wilaya)
  const selectedCommune = selectedWilaya ? findCommune(selectedWilaya, values.city) : null
  const estimated = delivery.estimate
  const subtotal = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0)
  const free = delivery.freeDelivery && subtotal >= delivery.freeDeliveryMin
  const missingForFree = delivery.freeDelivery && !free ? delivery.freeDeliveryMin - subtotal : 0
  const blocked = lines.find((l) => l.issue)

  // Delivery: type → shops that have the whole order (cheapest first) → desk.
  const [type, setType] = React.useState<"home" | "desk">("home")
  const [quote, setQuote] = React.useState<CheckoutQuote | null>(null)
  const [quoting, setQuoting] = React.useState(false)
  const [storeId, setStoreId] = React.useState<number | null>(null)
  const [deskId, setDeskId] = React.useState<number | null>(null)
  const [password, setPassword] = React.useState("")
  const [forgot, setForgot] = React.useState(false)
  const [phoneTaken, setPhoneTaken] = React.useState(false)
  const [referral, setReferral] = React.useState("")

  React.useEffect(() => {
    if (!selectedWilaya) return
    let live = true
    const t = window.setTimeout(async () => {
      setQuoting(true)
      const r = await quoteCheckoutAction({
        mode,
        buyNow: mode === "buy_now" ? { variantId: lines[0].variantId, quantity: lines[0].quantity } : undefined,
        wilaya: selectedWilaya.fr,
        city: selectedCommune ?? "",
        type,
      }).catch(() => null)
      if (!live) return
      setQuoting(false)
      setQuote(r)
      if (r?.ok) {
        const available = r.shops.filter((q) => q.available)
        const keep = available.find((q) => q.storeId === storeId) ?? available[0] ?? null
        setStoreId(keep?.storeId ?? null)
        setDeskId(keep && type === "desk" ? (keep.desks.some((d) => d.id === deskId) ? deskId : keep.suggestedDeskId) : null)
      }
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
    // Re-quote only when the destination, type or lines change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWilaya?.code, selectedCommune, type, mode, lines])

  const shops = quote?.ok ? quote.shops : []
  const chosen = shops.find((q) => q.storeId === storeId) ?? null
  const chosenDesk = chosen?.desks.find((d) => d.id === deskId) ?? null
  const courierFee = type === "desk" ? (chosenDesk?.price ?? null) : (chosen?.price ?? null)
  const deliveryFee = free ? 0 : (courierFee ?? 0)
  const deliveryLabel = !chosen ? "—" : free ? t("free") : courierFee === null ? t("byPhone") : formatDA(courierFee)
  const total = subtotal + deliveryFee
  const ready = Boolean(chosen && chosen.available && (type === "home" || chosenDesk))

  const set = (patch: Partial<CheckoutPrefill>) => {
    const next = { ...values, ...patch }
    setValues(next)
    if (draftTimer.current) window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => saveCheckoutDraftAction(next, mode).catch(() => {}), 900)
    setErrors((e) => {
      const copy = { ...e }
      for (const k of Object.keys(patch)) delete copy[k]
      return copy
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || blocked) return
    setSubmitting(true)
    setFormError(null)
    if (!ready) {
      setSubmitting(false)
      setFormError(selectedWilaya ? t("chooseHow") : t("chooseWilayaFirst"))
      return
    }
    const lang = document.documentElement.lang
    const result = await placeOrderAction({
      mode,
      buyNow: mode === "buy_now" ? { variantId: lines[0].variantId, quantity: lines[0].quantity } : undefined,
      idempotencyKey,
      customer: values,
      storeId,
      delivery: { type, deskId: type === "desk" ? deskId : null },
      referralSource: referral || null,
      locale: lang === "ar" || lang === "fr" || lang === "en" ? lang : null,
      account: account.signedIn ? undefined : { password, forgot },
    })
    if (result.ok) {
      if (mode === "cart") await refreshCart()
      router.replace(`/order/${encodeURIComponent(result.number)}?t=${encodeURIComponent(result.token)}`)
      return
    }
    setSubmitting(false)
    setFormError(et(result.error))
    if (result.fields) {
      const mapped: Record<string, string> = {}
      for (const [k, v] of Object.entries(result.fields)) mapped[k.replace(/^customer\./, "")] = et(v)
      setErrors(mapped)
      if (mapped.password && !account.signedIn) setPhoneTaken(true)
      setEditing(true)
    }
    if (result.stock) router.refresh()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
      <div className="space-y-10">
        {/* Contact + delivery */}
        <section aria-labelledby="details-title">
          <div className="flex items-center justify-between">
            <h2 id="details-title" className="king-label text-king-white">
              {t("details")}
            </h2>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="king-label inline-flex items-center gap-2 text-[0.6rem] text-king-muted hover:text-king-white">
                <Pencil className="size-3" aria-hidden /> {t("edit")}
              </button>
            )}
          </div>

          {!editing ? (
            <div className="mt-5 border border-white/10 bg-king-near-black p-5 text-sm leading-relaxed text-king-muted">
              <p className="font-semibold text-king-white">{values.fullName}</p>
              <p>{values.phone ? formatPhone(values.phone) : null}{values.email ? ` · ${values.email}` : ""}</p>
              <p className="mt-2 flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-king-bright-red" aria-hidden />
                <span>
                  {values.address}, {values.city}, {values.wilaya}
                </span>
              </p>
              <p className="king-label mt-3 text-[0.55rem] text-king-gray">{t("savedNote")}</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label={t("fullName")} error={errors.fullName} className="sm:col-span-2">
                {(id) => <Input id={id} value={values.fullName} onChange={(e) => set({ fullName: e.target.value })} autoComplete="name" required className={fieldClass} />}
              </Field>
              <Field label={t("phone")} error={errors.phone} hint={t("phoneHint")}>
                {(id) => <Input id={id} value={values.phone} onChange={(e) => set({ phone: e.target.value })} type="tel" inputMode="tel" autoComplete="tel" placeholder="05 / 06 / 07 …" required className={fieldClass} />}
              </Field>
              <Field label={t("email")} error={errors.email} hint={t("emailHint")}>
                {(id) => <Input id={id} value={values.email} onChange={(e) => set({ email: e.target.value })} type="email" autoComplete="email" className={fieldClass} />}
              </Field>
              {!account.signedIn && (
                <Field
                  label={phoneTaken ? t("passwordExisting") : t("passwordNew")}
                  error={errors.password}
                  hint={
                    phoneTaken
                      ? t("phoneHasAccount")
                      : t("accountNote")
                  }
                  className="sm:col-span-2"
                >
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setErrors((e) => {
                          const { password: _password, ...rest } = e
                          void _password
                          return rest
                        })
                      }}
                      autoComplete={phoneTaken ? "current-password" : "new-password"}
                      minLength={8}
                      required={!forgot}
                      disabled={forgot}
                      className={fieldClass}
                    />
                  )}
                </Field>
              )}
              {!account.signedIn && phoneTaken && (
                <label className="flex items-start gap-3 text-sm text-king-muted sm:col-span-2">
                  <input type="checkbox" checked={forgot} onChange={(e) => setForgot(e.target.checked)} className="mt-1 accent-[#d41414]" />
                  <span>
                    {t("forgot")}{" "}
                    <Link href="/sign-in" className="underline underline-offset-4">{t("signIn")}</Link> {t("laterToSee")}
                  </span>
                </label>
              )}
              {account.needsReferral && (
                <Field label={tr("question")} error={errors.referralSource} className="sm:col-span-2">
                  {(id) => (
                    <SelectBox id={id} value={referral} onChange={(v) => setReferral(v)} required={!account.signedIn}>
                      <option value="">{tr("choose")}</option>
                      {REFERRAL_SOURCES.map((r) => (
                        <option key={r.key} value={r.key}>
                          {tr(r.key)}
                        </option>
                      ))}
                    </SelectBox>
                  )}
                </Field>
              )}

              <Field label={t("wilaya")} error={errors.wilaya}>
                {(id) => (
                  <SelectBox
                    id={id}
                    value={selectedWilaya?.fr ?? ""}
                    onChange={(fr) => {
                      const next = findWilaya(fr)
                      // Keep the commune only if it belongs to the new wilaya.
                      set({ wilaya: fr, city: next && findCommune(next, values.city) ? values.city : "" })
                    }}
                    autoComplete="address-level1"
                  >
                    <option value="">{t("chooseWilaya")}</option>
                    {WILAYAS.map((w) => (
                      <option key={w.code} value={w.fr}>
                        {wilayaLabel(w)} · {w.ar}
                      </option>
                    ))}
                  </SelectBox>
                )}
              </Field>
              <Field label={t("commune")} error={errors.city} hint={selectedWilaya ? t("communesIn", { count: selectedWilaya.communes.length, wilaya: selectedWilaya.fr }) : t("chooseWilayaFirst")}>
                {(id) => (
                  <SelectBox
                    id={id}
                    value={selectedWilaya ? (findCommune(selectedWilaya, values.city) ?? "") : ""}
                    onChange={(city) => set({ city })}
                    disabled={!selectedWilaya}
                    autoComplete="address-level2"
                  >
                    <option value="">{selectedWilaya ? t("chooseCommune") : "—"}</option>
                    {selectedWilaya?.communes.map(([fr, ar]) => (
                      <option key={fr} value={fr}>
                        {fr} · {ar}
                      </option>
                    ))}
                  </SelectBox>
                )}
              </Field>
              <Field label={t("address")} error={errors.address} className="sm:col-span-2">
                {(id) => <Input id={id} value={values.address} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" required className={fieldClass} />}
              </Field>
              <Field label={t("notes")} error={errors.notes} className="sm:col-span-2">
                {(id) => (
                  <textarea
                    id={id}
                    value={values.notes}
                    onChange={(e) => set({ notes: e.target.value.slice(0, 500) })}
                    rows={2}
                    className="w-full rounded-[6px] border border-white/12 bg-black/40 p-3 text-sm text-king-white focus-visible:border-king-bright-red focus-visible:outline-none"
                  />
                )}
              </Field>
            </div>
          )}
        </section>

        <section aria-labelledby="delivery-title">
          <h2 id="delivery-title" className="king-label text-king-white">
            {t("delivery")}
          </h2>
          <div role="radiogroup" aria-label={t("deliveryType")} className="mt-5 grid grid-cols-2 gap-3">
            {(
              [
                ["home", t("home"), t("homeSub"), Home],
                ["desk", t("desk"), t("deskSub"), Building2],
              ] as const
            ).map(([key, title, sub, Icon]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={type === key}
                onClick={() => setType(key)}
                className={cn(
                  "flex items-start gap-3 border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-king-bright-red/40",
                  type === key ? "border-king-bright-red bg-king-red/10" : "border-white/10 bg-king-near-black hover:border-white/25"
                )}
              >
                <Icon className={cn("mt-0.5 size-5 shrink-0", type === key ? "text-king-bright-red" : "text-king-gray")} aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-king-white">{title}</span>
                  <span className="mt-0.5 block text-xs text-king-gray">{sub}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6" aria-live="polite">
            <p className="king-label flex items-center gap-2 text-[0.6rem] text-king-gray">
              <Store className="size-3.5 text-king-bright-red" aria-hidden /> {t("shipsFrom")}
              {quoting && <Loader2 className="size-3 animate-spin" aria-label={t("updatingPrices")} />}
            </p>
            {!selectedWilaya ? (
              <p className="mt-3 text-sm text-king-gray">{t("chooseWilayaShops")}</p>
            ) : quote && !quote.ok ? (
              <p role="alert" className="mt-3 flex items-start gap-2 border border-king-red-line bg-king-red/10 p-3 text-sm text-king-white">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-king-bright-red" aria-hidden />
                {et(quote.error)}
              </p>
            ) : (
              <ul role="radiogroup" aria-label={t("departureShop")} className="mt-3 space-y-2">
                {shops.map((q, i) => {
                  const selected = q.storeId === storeId
                  const price = free ? t("free") : q.price === null ? (q.available ? t("priceByPhone") : "") : formatDA(q.price)
                  return (
                    <li key={q.storeId}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!q.available}
                        onClick={() => {
                          setStoreId(q.storeId)
                          setDeskId(type === "desk" ? q.suggestedDeskId : null)
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-4 border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-king-bright-red/40 disabled:cursor-not-allowed disabled:opacity-45",
                          selected ? "border-king-bright-red bg-king-red/10" : "border-white/10 bg-king-near-black hover:border-white/25"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-king-bright-red bg-king-bright-red" : "border-white/30")} aria-hidden>
                            {selected && <Check className="size-3 text-king-white" />}
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-king-white">{q.storeName}</span>
                            <span className="block text-xs text-king-gray">
                              {!q.available ? t("noDesk", { wilaya: selectedWilaya.fr }) : i === 0 && shops.length > 1 ? t("cheapest") : t("hasAll")}
                            </span>
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-king-white tabular-nums">{price}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {type === "desk" && chosen && chosen.available && (
            <div className="mt-5">
              <Field label={t("desk")} error={errors["delivery.deskId"]} hint={chosenDesk?.address ? `${chosenDesk.address} · ${chosenDesk.commune}` : t("deskSuggested")}>
                {(id) => (
                  <SelectBox id={id} value={deskId ? String(deskId) : ""} onChange={(v) => setDeskId(Number(v) || null)}>
                    {chosen.desks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.commune} — {d.name}
                        {d.price !== null ? ` · ${formatDA(d.price)}` : ""}
                        {d.id === chosen.suggestedDeskId ? t("closest") : ""}
                      </option>
                    ))}
                  </SelectBox>
                )}
              </Field>
            </div>
          )}
          {estimated && <p className="mt-4 text-xs text-king-gray">{t("deliveryTime", { time: estimated })}</p>}
        </section>

        <section aria-labelledby="payment-title">
          <h2 id="payment-title" className="king-label text-king-white">
            {t("payment")}
          </h2>

          <p className="mt-5 flex items-start gap-3 border border-white/10 bg-king-near-black p-5 text-sm text-king-muted">
            <Banknote className="mt-0.5 size-4 shrink-0 text-king-bright-red" aria-hidden />
            <span>
              <span className="font-semibold text-king-white">{t("cod")}</span> {t("codText")}
            </span>
          </p>
        </section>
      </div>

      {/* Summary */}
      <aside aria-labelledby="summary-title" className="lg:sticky lg:top-24 lg:self-start">
        <div className="king-chamfer border border-white/10 bg-king-near-black p-6 [--cut:18px] md:p-8">
          <h2 id="summary-title" className="king-label text-king-white">
            {mode === "buy_now" ? t("buyNow") : t("yourBag", { count: lines.reduce((s, l) => s + l.quantity, 0) })}
          </h2>
          <ul className="mt-5 divide-y divide-white/5">
            {lines.map((l) => (
              <li key={l.variantId} className="flex gap-4 py-4">
                <span className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-king-card">
                  <ProductImage image={l.image} alt="" sizes="140px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-king-white uppercase">{l.name}</span>
                  <span className="king-label mt-1 block text-[0.55rem] text-king-gray">
                    {l.color} / {l.size} × {l.quantity}
                  </span>
                  {l.issue && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-king-bright-red">
                      <AlertTriangle className="size-3" aria-hidden />
                      {l.issue === "not_enough" ? t("onlyLeft", { count: l.available }) : t("noLonger")}
                    </span>
                  )}
                </span>
                <span className="king-label text-[0.6rem] text-king-muted">{formatDA(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-king-gray">
              <dt>{t("clothes")}</dt>
              <dd className="text-king-white">{formatDA(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-king-gray">
              <dt>
                {type === "desk" ? t("desk") : t("home")}
                {chosen ? <span className="block text-xs">{t("from", { shop: chosen.storeName })}</span> : null}
              </dt>
              <dd className="text-right text-king-white">{deliveryLabel}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3 text-base">
              <dt className="font-semibold text-king-white">{t("toPay")}</dt>
              <dd className="font-semibold text-king-white">{formatDA(total)}</dd>
            </div>
            {missingForFree > 0 && (
              <p className="text-xs text-king-bright-red">{t("moreForFree", { amount: formatDA(missingForFree) })}</p>
            )}
          </dl>

          {formError && (
            <p role="alert" className="mt-5 flex items-start gap-2 border border-king-red-line bg-king-red/10 p-3 text-sm text-king-white">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-king-bright-red" aria-hidden />
              {formError}
            </p>
          )}
          {blocked && mode === "cart" && (
            <p className="mt-5 text-sm text-king-bright-red">
              {t("itemsChanged")} <Link href="/clothes" className="underline">{t("updateBag")}</Link> {t("toContinue")}
            </p>
          )}

          <Button type="submit" variant="king" size="xl" className="mt-6 w-full" disabled={submitting || !!blocked || !ready}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {submitting ? t("placing") : t("confirm", { total: formatDA(total) })}
          </Button>
          <p className="mt-3 text-center text-xs text-king-gray">{t("checkedAgain")}</p>
        </div>
      </aside>
    </form>
  )
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: string
  className?: string
  children: (id: string) => React.ReactNode
}) {
  const id = React.useId()
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium text-king-white">
        {label}
      </Label>
      {children(id)}
      {error ? (
        <p className="text-xs text-king-bright-red" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-king-gray">{hint}</p>
      ) : null}
    </div>
  )
}

/** Native select (best on phones) styled like the other fields. */
function SelectBox({
  id,
  value,
  onChange,
  disabled,
  autoComplete,
  required = true,
  children,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoComplete?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        required={required}
        className={cn(fieldClass, "w-full appearance-none border pr-10 disabled:cursor-not-allowed disabled:opacity-50", !value && "text-king-gray")}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-king-gray" aria-hidden />
    </div>
  )
}

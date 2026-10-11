"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Banknote, ChevronDown, Loader2, MapPin, Pencil, Truck } from "lucide-react"

import { cn } from "@/lib/utils"
import { findCommune, findWilaya, WILAYAS, wilayaLabel } from "@/lib/algeria"
import { formatDA } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { placeOrderAction, saveCheckoutDraftAction } from "@/app/actions/checkout"
import type { CartLine } from "@/server/cart"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useShop } from "@/components/providers/shop-provider"
import { ProductImage } from "@/components/shop/product-image"

export type CheckoutPrefill = {
  fullName: string
  age: string
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
}: {
  mode: "buy_now" | "cart"
  lines: CartLine[]
  /** One fee for all of Algeria (0 = confirmed by phone); free when the promotion applies. */
  delivery: { fee: number; estimate: string; freeDelivery: boolean; freeDeliveryMin: number }
  prefill: CheckoutPrefill
  /** True when details were saved from a previous checkout — show them as a summary. */
  returning: boolean
}) {
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
  const estimated = delivery.estimate
  const subtotal = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0)
  const free = delivery.freeDelivery && subtotal >= delivery.freeDeliveryMin
  const deliveryFee = free ? 0 : delivery.fee
  const missingForFree = delivery.freeDelivery && !free ? delivery.freeDeliveryMin - subtotal : 0
  const blocked = lines.find((l) => l.issue)

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
    const result = await placeOrderAction({
      mode,
      buyNow: mode === "buy_now" ? { variantId: lines[0].variantId, quantity: lines[0].quantity } : undefined,
      idempotencyKey,
      customer: values,
    })
    if (result.ok) {
      if (mode === "cart") await refreshCart()
      router.replace(`/order/${encodeURIComponent(result.number)}?t=${encodeURIComponent(result.token)}`)
      return
    }
    setSubmitting(false)
    setFormError(result.error)
    if (result.fields) {
      const mapped: Record<string, string> = {}
      for (const [k, v] of Object.entries(result.fields)) mapped[k.replace(/^customer\./, "")] = v
      setErrors(mapped)
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
              01 — Your details
            </h2>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="king-label inline-flex items-center gap-2 text-[0.6rem] text-king-muted hover:text-king-white">
                <Pencil className="size-3" aria-hidden /> Edit
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
              <p className="king-label mt-3 text-[0.55rem] text-king-gray">Saved from your last order — edit anything before confirming.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Full name" error={errors.fullName} className="sm:col-span-2">
                {(id) => <Input id={id} value={values.fullName} onChange={(e) => set({ fullName: e.target.value })} autoComplete="name" required className={fieldClass} />}
              </Field>
              <Field label="Phone" error={errors.phone} hint="We'll call to confirm.">
                {(id) => <Input id={id} value={values.phone} onChange={(e) => set({ phone: e.target.value })} type="tel" inputMode="tel" autoComplete="tel" placeholder="05 / 06 / 07 …" required className={fieldClass} />}
              </Field>
              <Field label="Age" error={errors.age}>
                {(id) => <Input id={id} value={values.age} onChange={(e) => set({ age: e.target.value.replace(/\D/g, "").slice(0, 3) })} inputMode="numeric" required className={fieldClass} />}
              </Field>
              <Field label="Email (optional)" error={errors.email} hint="For order updates by email." className="sm:col-span-2">
                {(id) => <Input id={id} value={values.email} onChange={(e) => set({ email: e.target.value })} type="email" autoComplete="email" className={fieldClass} />}
              </Field>

              <Field label="Wilaya" error={errors.wilaya}>
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
                    <option value="">Choose your wilaya…</option>
                    {WILAYAS.map((w) => (
                      <option key={w.code} value={w.fr}>
                        {wilayaLabel(w)} · {w.ar}
                      </option>
                    ))}
                  </SelectBox>
                )}
              </Field>
              <Field label="Commune" error={errors.city} hint={selectedWilaya ? `${selectedWilaya.communes.length} communes in ${selectedWilaya.fr}` : "Choose your wilaya first."}>
                {(id) => (
                  <SelectBox
                    id={id}
                    value={selectedWilaya ? (findCommune(selectedWilaya, values.city) ?? "") : ""}
                    onChange={(city) => set({ city })}
                    disabled={!selectedWilaya}
                    autoComplete="address-level2"
                  >
                    <option value="">{selectedWilaya ? "Choose your commune…" : "—"}</option>
                    {selectedWilaya?.communes.map(([fr, ar]) => (
                      <option key={fr} value={fr}>
                        {fr} · {ar}
                      </option>
                    ))}
                  </SelectBox>
                )}
              </Field>
              <Field label="Street / address" error={errors.address} className="sm:col-span-2">
                {(id) => <Input id={id} value={values.address} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" required className={fieldClass} />}
              </Field>
              <p className="flex items-start gap-2 text-xs text-king-gray sm:col-span-2">
                <Truck className="mt-0.5 size-3.5 shrink-0 text-king-bright-red" aria-hidden />
                <span>
                  Home delivery everywhere in Algeria{free ? " · free" : deliveryFee > 0 ? ` · ${formatDA(deliveryFee)}` : ""}
                  {estimated ? ` · ${estimated}` : ""}. Already ordered and not delivered yet? Orders to the same address come in one delivery — you pay
                  it only once.
                </span>
              </p>

              <Field label="Delivery notes (optional)" error={errors.notes} className="sm:col-span-2">
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

        <section aria-labelledby="payment-title">
          <h2 id="payment-title" className="king-label text-king-white">
            02 — Payment
          </h2>
          <p className="mt-5 flex items-start gap-3 border border-white/10 bg-king-near-black p-5 text-sm text-king-muted">
            <Banknote className="mt-0.5 size-4 shrink-0 text-king-bright-red" aria-hidden />
            <span>
              <span className="font-semibold text-king-white">Cash on delivery.</span> Pay when your order arrives. We call you first to confirm.
            </span>
          </p>
        </section>
      </div>

      {/* Summary */}
      <aside aria-labelledby="summary-title" className="lg:sticky lg:top-24 lg:self-start">
        <div className="king-chamfer border border-white/10 bg-king-near-black p-6 [--cut:18px] md:p-8">
          <h2 id="summary-title" className="king-label text-king-white">
            {mode === "buy_now" ? "Buy now" : `Your bag (${lines.reduce((s, l) => s + l.quantity, 0)})`}
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
                      {l.issue === "not_enough" ? `Only ${l.available} left` : "No longer available"}
                    </span>
                  )}
                </span>
                <span className="king-label text-[0.6rem] text-king-muted">{formatDA(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-king-gray">
              <dt>Clothes</dt>
              <dd className="text-king-white">{formatDA(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-king-gray">
              <dt>Delivery{estimated ? ` · ${estimated}` : ""}</dt>
              <dd className="text-right text-king-white">{free ? "Free" : deliveryFee > 0 ? formatDA(deliveryFee) : "Confirmed by phone"}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3 text-base">
              <dt className="font-semibold text-king-white">To pay on delivery</dt>
              <dd className="font-semibold text-king-white">{formatDA(subtotal + deliveryFee)}</dd>
            </div>
            {missingForFree > 0 && (
              <p className="text-xs text-king-bright-red">Add {formatDA(missingForFree)} more for free delivery.</p>
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
              Some items changed. <Link href="/clothes" className="underline">Update your bag</Link> to continue.
            </p>
          )}

          <Button type="submit" variant="king" size="xl" className="mt-6 w-full" disabled={submitting || !!blocked}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {submitting ? "Placing your order…" : `Confirm order — ${formatDA(subtotal + deliveryFee)}`}
          </Button>
          <p className="mt-3 text-center text-xs text-king-gray">Prices and stock are checked again when you confirm.</p>
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
  children,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoComplete?: string
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
        required
        className={cn(fieldClass, "w-full appearance-none border pr-10 disabled:cursor-not-allowed disabled:opacity-50", !value && "text-king-gray")}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-king-gray" aria-hidden />
    </div>
  )
}

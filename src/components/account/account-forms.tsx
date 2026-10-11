"use client"

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
  if (!result) return null
  return result.ok ? (
    <p role="status" className="flex items-center gap-2 text-sm text-emerald-300">
      <Check className="size-4" aria-hidden /> {result.message}
    </p>
  ) : (
    <p role="alert" className="text-sm text-king-bright-red">
      {result.error}
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
  const { pending, result, run } = useAccountAction()
  const [v, setV] = React.useState(initial)
  const wilaya = findWilaya(v.wilaya)
  const dirty = (["name", "phone", "wilaya", "city", "address"] as const).some((k) => v[k] !== initial[k])

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => updateDetailsAction({ name: v.name, phone: v.phone, wilaya: v.wilaya, city: v.city, address: v.address }))
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="acc-name" className={label}>
            Full name
          </label>
          <input id="acc-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" className={field} />
        </div>
        <div>
          <label htmlFor="acc-email" className={label}>
            Email <span className="font-normal text-king-gray">· used to sign in</span>
          </label>
          <input id="acc-email" value={v.email} disabled className={field} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="acc-phone" className={label}>
            Phone
          </label>
          <input id="acc-phone" type="tel" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="05 / 06 / 07 …" autoComplete="tel" className={field} />
        </div>
      </div>

      <fieldset className="space-y-5 border-t border-white/10 pt-6">
        <legend className="king-label flex items-center gap-2 text-[0.6rem] text-king-gray">
          <MapPin className="size-3.5 text-king-bright-red" aria-hidden /> Delivery address
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="acc-wilaya" className={label}>
              Wilaya
            </label>
            <Select
              id="acc-wilaya"
              value={wilaya?.fr ?? ""}
              onChange={(fr) => {
                const next = findWilaya(fr)
                setV({ ...v, wilaya: fr, city: next && findCommune(next, v.city) ? v.city : "" })
              }}
            >
              <option value="">Choose your wilaya…</option>
              {WILAYAS.map((w) => (
                <option key={w.code} value={w.fr}>
                  {wilayaLabel(w)} · {w.ar}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="acc-city" className={label}>
              Commune
            </label>
            <Select id="acc-city" value={wilaya ? (findCommune(wilaya, v.city) ?? "") : ""} onChange={(city) => setV({ ...v, city })} disabled={!wilaya}>
              <option value="">{wilaya ? "Choose your commune…" : "Choose your wilaya first"}</option>
              {wilaya?.communes.map(([fr, ar]) => (
                <option key={fr} value={fr}>
                  {fr} · {ar}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="acc-address" className={label}>
              Street / address
            </label>
            <input id="acc-address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} autoComplete="street-address" className={field} />
          </div>
        </div>
        <p className="text-xs text-king-gray">Saved details fill in checkout for you — you can still change them on each order.</p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="king" size="xl" disabled={pending || !dirty}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save changes
        </Button>
        {(initial.wilaya || initial.address) && <RemoveAddress />}
        <Message result={result} />
      </div>
    </form>
  )
}

function RemoveAddress() {
  const { pending, result, run } = useAccountAction()
  const [asking, setAsking] = React.useState(false)
  if (!asking) {
    return (
      <Button type="button" variant="kingOutline" size="xl" onClick={() => setAsking(true)}>
        <Trash2 className="size-4" aria-hidden /> Remove address
      </Button>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm text-king-white">Remove your saved address?</span>
      <Button type="button" variant="king" size="lg" disabled={pending} onClick={() => run(removeAddressAction, () => setAsking(false))}>
        Yes, remove
      </Button>
      <Button type="button" variant="kingOutline" size="lg" onClick={() => setAsking(false)}>
        Cancel
      </Button>
      <Message result={result} />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Security                                                           */
/* ------------------------------------------------------------------ */

export function PasswordForm() {
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
            ["current", "Current password", "current-password"],
            ["next", "New password", "new-password"],
            ["repeat", "Repeat new password", "new-password"],
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
      <p className="text-xs text-king-gray">At least 10 characters, with letters and a number. Other devices are signed out.</p>
      {mismatch && <p className="text-sm text-king-bright-red">The new passwords don&apos;t match.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="king" size="xl" disabled={pending || !v.current || !v.next || mismatch}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Change password
        </Button>
        <Message result={result} />
      </div>
    </form>
  )
}

export function DeleteAccount() {
  const { pending, result, run } = useAccountAction()
  const [open, setOpen] = React.useState(false)
  const [password, setPassword] = React.useState("")
  if (!open) {
    return (
      <Button type="button" variant="kingOutline" size="xl" onClick={() => setOpen(true)} className="border-king-red-line text-king-bright-red hover:bg-king-red hover:text-king-white">
        <Trash2 className="size-4" aria-hidden /> Delete my account
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
        This deletes your account, saved details and wishlist. Orders you placed stay with KING 253 so they can still be delivered or returned.
      </p>
      <div className="max-w-sm">
        <label htmlFor="del-password" className={label}>
          Your password, to confirm
        </label>
        <input id="del-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={field} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="king" size="xl" disabled={pending || !password}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Delete permanently
        </Button>
        <Button type="button" variant="kingOutline" size="xl" onClick={() => setOpen(false)}>
          Cancel
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
  const { pending, result, run } = useAccountAction()
  const [asking, setAsking] = React.useState(false)
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {result && !result.ok && <Message result={result} />}
      {!asking ? (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="king-label inline-flex h-9 items-center gap-2 px-3 text-[0.6rem] text-king-gray transition-colors hover:text-king-bright-red"
        >
          <Trash2 className="size-3.5" aria-hidden /> Remove from my orders
        </button>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-xs text-king-white">Remove this {kind} order from your list?</span>
          <Button type="button" variant="king" size="lg" disabled={pending} onClick={() => run(() => removeCancelledOrderAction(orderId))}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Yes, remove
          </Button>
          <Button type="button" variant="kingOutline" size="lg" onClick={() => setAsking(false)}>
            Cancel
          </Button>
        </span>
      )}
    </div>
  )
}

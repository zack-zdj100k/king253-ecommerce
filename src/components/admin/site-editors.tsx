"use client"

import * as React from "react"

import { deleteStoreAction, saveSettingsAction, saveStoreAction } from "@/app/admin/actions/site"
import { DeleteButton } from "@/components/admin/delete-button"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass, textareaClass } from "@/components/admin/ui"

/* ------------------------------------------------------------------ */
/* Shops (Location page)                                              */
/* ------------------------------------------------------------------ */

type StoreRow = {
  id: number
  name: string
  wilaya: string
  city: string
  address: string
  phone: string | null
  hours: string | null
  mapUrl: string | null
  latitude: number | null
  longitude: number | null
  active: boolean
  sortOrder: number
}

const toForm = (s: StoreRow | null) => ({
  name: s?.name ?? "",
  wilaya: s?.wilaya ?? "",
  city: s?.city ?? "",
  address: s?.address ?? "",
  phone: s?.phone ?? "",
  hours: s?.hours ?? "",
  mapUrl: s?.mapUrl ?? "",
  latitude: s?.latitude === null || s?.latitude === undefined ? "" : String(s.latitude),
  longitude: s?.longitude === null || s?.longitude === undefined ? "" : String(s.longitude),
  active: s?.active ?? true,
  sortOrder: String(s?.sortOrder ?? 0),
})

/** "36.7538, 3.0588" pasted from Google Maps → both fields at once. */
function splitCoords(text: string) {
  const m = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/)
  return m ? { latitude: m[1], longitude: m[2] } : null
}

export function StoreEditor({ store }: { store: StoreRow | null }) {
  const { run, pending, feedback } = useAdminAction()
  const [v, setV] = React.useState(() => toForm(store))
  const set = (patch: Partial<typeof v>) => setV((prev) => ({ ...prev, ...patch }))
  const text = (key: "name" | "wilaya" | "city" | "address" | "phone" | "mapUrl", label: string, extra?: { placeholder?: string; wide?: boolean }) => (
    <label className={extra?.wide ? "block md:col-span-2" : "block"}>
      <span className={labelClass}>{label}</span>
      <input value={v[key]} onChange={(e) => set({ [key]: e.target.value })} placeholder={extra?.placeholder} className={inputClass} />
    </label>
  )
  return (
    <form
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () => saveStoreAction(store?.id ?? null, { ...v, sortOrder: Number(v.sortOrder) || 0 }),
          () => !store && setV(toForm(null))
        )
      }}
    >
      {text("name", "Shop name", { placeholder: "e.g. KING 253 — Bab Ezzouar" })}
      {text("phone", "Shop phone (optional)")}
      {text("wilaya", "Wilaya")}
      {text("city", "City")}
      {text("address", "Street address", { wide: true })}
      <label className="block md:col-span-2">
        <span className={labelClass}>Opening hours (optional)</span>
        <textarea value={v.hours} onChange={(e) => set({ hours: e.target.value })} rows={3} placeholder={"Sat–Thu | 10:00–20:00\nFri | Closed"} className={textareaClass} />
        <span className="mt-1 block text-xs text-king-gray">One line per row: Days | Hours</span>
      </label>
      {text("mapUrl", "Google Maps link (optional)", { placeholder: "https://maps.app.goo.gl/…", wide: true })}
      <label className="block">
        <span className={labelClass}>Latitude (optional)</span>
        <input
          value={v.latitude}
          onChange={(e) => set(splitCoords(e.target.value) ?? { latitude: e.target.value })}
          inputMode="decimal"
          placeholder="36.75"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Longitude (optional)</span>
        <input value={v.longitude} onChange={(e) => set({ longitude: e.target.value })} inputMode="decimal" placeholder="3.05" className={inputClass} />
      </label>
      <p className="text-xs text-king-gray md:col-span-2">
        Coordinates power the map and “Find the closest shop”. In Google Maps, right-click the shop and click the numbers to copy them, then paste
        into Latitude — both fields fill in.
      </p>
      <label className="block">
        <span className={labelClass}>Order on the page</span>
        <input value={v.sortOrder} onChange={(e) => set({ sortOrder: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={inputClass} />
      </label>
      <label className="flex items-center gap-2 pt-5 text-sm text-king-muted">
        <input type="checkbox" checked={v.active} onChange={(e) => set({ active: e.target.checked })} className="accent-[#a30d0d]" /> Show on the Location page
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" disabled={pending} className={store ? btnOutline : btnRed}>
          {store ? "Save shop" : "Add shop"}
        </button>
        {store && <DeleteButton label="Delete shop" confirm={`Delete ${store.name}?`} action={deleteStoreAction.bind(null, store.id)} />}
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Settings                                                           */
/* ------------------------------------------------------------------ */

type SettingsValues = Record<string, string | number | boolean>

const GROUPS: { title: string; fields: { key: string; label: string; type?: "number" | "boolean" | "textarea"; help?: string }[] }[] = [
  { title: "Brand & contact", fields: [{ key: "brandName", label: "Brand name" }, { key: "contactPhone", label: "Contact phone" }, { key: "contactEmail", label: "Contact email" }, { key: "whatsapp", label: "WhatsApp number" }] },
  { title: "Social links", fields: [{ key: "instagram", label: "Instagram (@handle or URL)" }, { key: "tiktok", label: "TikTok (@handle or URL)" }, { key: "facebook", label: "Facebook URL" }] },
  {
    title: "Delivery",
    fields: [
      { key: "deliveryFee", label: "Home delivery fee (DA)", type: "number", help: "What the courier charges — paid by the customer, never part of the clothes price. 0 = confirmed by phone, set per order." },
      { key: "freeDelivery", label: "Free delivery promotion — the shop pays the courier", type: "boolean" },
      { key: "freeDeliveryMin", label: "Free delivery from (clothes total, DA)", type: "number", help: "0 = every order. Orders that ship together count together." },
      { key: "deliveryEstimate", label: "Delivery time shown at checkout", help: "e.g. 2–5 days. Leave empty to hide." },
    ],
  },
  {
    title: "Orders & stock",
    fields: [
      { key: "orderPrefix", label: "Order number prefix", help: "KING253 → KING253-20261004-001" },
      { key: "lowStockThreshold", label: "Default low-stock alert", type: "number" },
      { key: "abandonedCartHours", label: "Cart counts as abandoned after (hours)", type: "number" },
    ],
  },
  {
    title: "Email",
    fields: [
      { key: "adminNotifyEmail", label: "New-order alerts go to", help: "Leave empty to use the contact email." },
      { key: "emailFromName", label: "Sender name" },
      { key: "customerEmailsEnabled", label: "Send order emails to customers who gave an email", type: "boolean" },
    ],
  },
  {
    title: "Developer credit (footer)",
    fields: [
      { key: "developerName", label: "Developer name", help: "Shown as “Developed by …” at the bottom of every page. Leave everything empty to hide it." },
      { key: "developerPhone", label: "Developer phone" },
      { key: "developerEmail", label: "Developer email" },
      { key: "developerGithub", label: "GitHub (username or URL)" },
    ],
  },
]

export function SettingsForm({ values, smtpConfigured }: { values: SettingsValues; smtpConfigured: boolean }) {
  const { run, pending, feedback } = useAdminAction()
  const [v, setV] = React.useState(values)
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        // Only this form's own fields — the shop status panel saves its settings separately.
        run(() => saveSettingsAction(Object.fromEntries(GROUPS.flatMap((g) => g.fields.map((f) => [f.key, v[f.key]])))))
      }}
    >
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 pt-3">
          <legend className="px-2 text-sm font-semibold text-king-white">{g.title}</legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {g.fields.map((f) => (
              <label key={f.key} className={f.type === "textarea" ? "block md:col-span-2" : "block"}>
                {f.type === "boolean" ? (
                  <span className="flex items-center gap-2 pt-5 text-sm text-king-muted">
                    <input type="checkbox" checked={Boolean(v[f.key])} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} className="accent-[#a30d0d]" /> {f.label}
                  </span>
                ) : (
                  <>
                    <span className={labelClass}>{f.label}</span>
                    {f.type === "textarea" ? (
                      <textarea value={String(v[f.key] ?? "")} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} rows={4} className={textareaClass} />
                    ) : (
                      <input
                        value={String(v[f.key] ?? "")}
                        onChange={(e) => setV({ ...v, [f.key]: f.type === "number" ? Number(e.target.value.replace(/\D/g, "")) : e.target.value })}
                        inputMode={f.type === "number" ? "numeric" : undefined}
                        className={inputClass}
                      />
                    )}
                  </>
                )}
                {f.help && <span className="mt-1 block text-xs text-king-gray">{f.help}</span>}
              </label>
            ))}
          </div>
          {g.title === "Email" && (
            <p className="mt-4 text-xs text-king-gray">
              Email service: {smtpConfigured ? "active — emails are sent." : "not set up yet — no emails are sent for now. Ask your developer to activate it."}
            </p>
          )}
        </fieldset>
      ))}
      <div className="sticky bottom-4 z-10 flex items-center gap-4 rounded-full border border-white/10 bg-black/80 p-2 pl-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <button type="submit" disabled={pending} className={btnRed}>Save settings</button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

"use client"

import * as React from "react"
import { Upload } from "lucide-react"

import { deleteDeskAction, importDeliveryAction, saveDeskAction, saveRatesAction } from "@/app/admin/actions/delivery"
import { DeleteButton } from "@/components/admin/delete-button"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnOutline, btnRed, inputClass, labelClass, selectClass, td, th, Table } from "@/components/admin/ui"

const digits = (v: string) => v.replace(/\D/g, "")
const str = (n: number | null) => (n === null ? "" : String(n))

/* ------------------------------------------------------------------ */
/* Prices per wilaya                                                  */
/* ------------------------------------------------------------------ */

type RateRow = { code: number; nameFr: string; nameAr: string; homePrice: number | null; deskPrice: number | null; returnPrice: number | null; desks: number }

export function RatesEditor({ storeId, rows }: { storeId: number; rows: RateRow[] }) {
  const { run, pending, feedback } = useAdminAction()
  const initial = React.useMemo(() => Object.fromEntries(rows.map((r) => [r.code, { home: str(r.homePrice), desk: str(r.deskPrice), ret: str(r.returnPrice) }])), [rows])
  const [v, setV] = React.useState(initial)
  const [q, setQ] = React.useState("")
  const [all, setAll] = React.useState({ home: "", desk: "", ret: "" })
  const changed = rows.filter((r) => v[r.code].home !== initial[r.code].home || v[r.code].desk !== initial[r.code].desk || v[r.code].ret !== initial[r.code].ret)
  const shown = rows.filter((r) => !q || `${r.code} ${r.nameFr} ${r.nameAr}`.toLowerCase().includes(q.toLowerCase()))
  const set = (code: number, key: "home" | "desk" | "ret", value: string) => setV((prev) => ({ ...prev, [code]: { ...prev[code], [key]: digits(value) } }))

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(() =>
          saveRatesAction(
            storeId,
            changed.map((r) => ({ wilayaCode: r.code, homePrice: v[r.code].home, deskPrice: v[r.code].desk, returnPrice: v[r.code].ret }))
          )
        )
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-56">
          <span className={labelClass}>Find a wilaya</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code or name" className={inputClass} />
        </label>
        <label className="block w-32">
          <span className={labelClass}>Home · empty rows</span>
          <input value={all.home} onChange={(e) => setAll({ ...all, home: digits(e.target.value) })} inputMode="numeric" placeholder="DA" className={inputClass} />
        </label>
        <label className="block w-32">
          <span className={labelClass}>Desk · empty rows</span>
          <input value={all.desk} onChange={(e) => setAll({ ...all, desk: digits(e.target.value) })} inputMode="numeric" placeholder="DA" className={inputClass} />
        </label>
        <label className="block w-32">
          <span className={labelClass}>Return · empty rows</span>
          <input value={all.ret} onChange={(e) => setAll({ ...all, ret: digits(e.target.value) })} inputMode="numeric" placeholder="DA" className={inputClass} />
        </label>
        <button
          type="button"
          className={btnOutline}
          disabled={!all.home && !all.desk && !all.ret}
          onClick={() =>
            setV((prev) =>
              Object.fromEntries(
                Object.entries(prev).map(([code, p]) => [code, { home: p.home || all.home, desk: p.desk || all.desk, ret: p.ret || all.ret }])
              )
            )
          }
        >
          Fill empty rows
        </button>
      </div>

      <Table>
        <thead>
          <tr>
            <th className={th}>Wilaya</th>
            <th className={`${th} w-36`}>Home (DA)</th>
            <th className={`${th} w-36`}>Stop desk (DA)</th>
            <th className={`${th} w-32`}>Return (DA)</th>
            <th className={`${th} text-right`}>Desks</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.code}>
              <td className={td}>
                <span className="tabular-nums text-king-gray">{String(r.code).padStart(2, "0")}</span> <span className="text-king-white">{r.nameFr}</span>{" "}
                <span className="text-king-gray" dir="rtl">
                  {r.nameAr}
                </span>
              </td>
              <td className={td}>
                <input
                  value={v[r.code].home}
                  onChange={(e) => set(r.code, "home", e.target.value)}
                  inputMode="numeric"
                  placeholder="By phone"
                  aria-label={`Home delivery price to ${r.nameFr}`}
                  className={`${inputClass} h-9`}
                />
              </td>
              <td className={td}>
                <input
                  value={v[r.code].desk}
                  onChange={(e) => set(r.code, "desk", e.target.value)}
                  inputMode="numeric"
                  placeholder="—"
                  aria-label={`Stop desk price to ${r.nameFr}`}
                  className={`${inputClass} h-9`}
                />
              </td>
              <td className={td}>
                <input
                  value={v[r.code].ret}
                  onChange={(e) => set(r.code, "ret", e.target.value)}
                  inputMode="numeric"
                  placeholder="Not set"
                  aria-label={`Return fee from ${r.nameFr}`}
                  className={`${inputClass} h-9`}
                />
              </td>
              <td className={`${td} text-right tabular-nums`}>{r.desks || "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-black/80 p-3 backdrop-blur md:bottom-4">
        <button type="submit" disabled={pending || changed.length === 0} className={btnRed}>
          Save {changed.length ? `${changed.length} change${changed.length > 1 ? "s" : ""}` : "prices"}
        </button>
        <span className="text-xs text-king-gray">Empty home price = price confirmed by phone. Return = what the courier charges the shop to bring a refused or returned parcel back.</span>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Desks                                                              */
/* ------------------------------------------------------------------ */

type Wilaya = { code: number; nameFr: string }
type DeskRow = { id: number; wilayaCode: number; commune: string; name: string; address: string; deskPrice: number | null; active: boolean }

export function DeskEditor({ storeId, desk, wilayas }: { storeId: number; desk: DeskRow | null; wilayas: Wilaya[] }) {
  const { run, pending, feedback } = useAdminAction()
  const blank = { wilayaCode: "", commune: "", name: "", address: "", deskPrice: "", active: true }
  const toForm = (d: DeskRow | null) =>
    d ? { wilayaCode: String(d.wilayaCode), commune: d.commune, name: d.name, address: d.address, deskPrice: str(d.deskPrice), active: d.active } : blank
  const [v, setV] = React.useState(() => toForm(desk))

  return (
    <form
      className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_1fr_1.4fr_110px_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveDeskAction(storeId, desk?.id ?? null, v), () => !desk && setV(blank))
      }}
    >
      <label className="block">
        <span className={labelClass}>Wilaya</span>
        <select value={v.wilayaCode} onChange={(e) => setV({ ...v, wilayaCode: e.target.value })} className={selectClass} required>
          <option value="">Choose…</option>
          {wilayas.map((w) => (
            <option key={w.code} value={w.code}>
              {String(w.code).padStart(2, "0")} — {w.nameFr}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>Commune</span>
        <input value={v.commune} onChange={(e) => setV({ ...v, commune: e.target.value })} className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Desk name</span>
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Address</span>
        <input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Price (DA)</span>
        <input
          value={v.deskPrice}
          onChange={(e) => setV({ ...v, deskPrice: digits(e.target.value) })}
          inputMode="numeric"
          placeholder="Wilaya's"
          className={inputClass}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-king-muted">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="accent-[#a30d0d]" /> Open
        </label>
        <button type="submit" disabled={pending} className={desk ? btnOutline : btnRed}>
          {desk ? "Save" : "Add desk"}
        </button>
        {desk && <DeleteButton compact label={`Delete ${desk.name}`} confirm="Delete desk?" action={deleteDeskAction.bind(null, storeId, desk.id)} />}
      </div>
      <div className="md:col-span-6">
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* CSV import                                                         */
/* ------------------------------------------------------------------ */

export function DeliveryImport() {
  const { run, pending, feedback } = useAdminAction()
  const [kind, setKind] = React.useState<"rates" | "desks">("rates")
  const [file, setFile] = React.useState<File | null>(null)

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!file) return
        run(async () => {
          const r = await importDeliveryAction(kind, await file.text())
          return r.ok ? { ok: true as const, message: `Imported ${r.data.imported} row(s).` } : r
        })
      }}
    >
      <label className="block w-48">
        <span className={labelClass}>File type</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as "rates" | "desks")} className={selectClass}>
          <option value="rates">Prices per wilaya</option>
          <option value="desks">Stop desks</option>
        </select>
      </label>
      <label className="block min-w-56 flex-1">
        <span className={labelClass}>CSV file</span>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={`${inputClass} py-2`} />
      </label>
      <button type="submit" disabled={!file || pending} className={btnRed}>
        <Upload className="size-4" aria-hidden /> Import
      </button>
      <div className="w-full">
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

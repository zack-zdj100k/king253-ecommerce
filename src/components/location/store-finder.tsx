"use client"

import * as React from "react"
import { Clock, Crosshair, ExternalLink, Loader2, MapPin, Navigation, Phone } from "lucide-react"

import { cn } from "@/lib/utils"
import { parseHours } from "@/lib/hours"
import { Button } from "@/components/ui/button"

export type PublicStore = {
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
}

/** Great-circle distance in km. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

const hasCoords = (s: PublicStore): s is PublicStore & { latitude: number; longitude: number } => s.latitude !== null && s.longitude !== null
const fullAddress = (s: PublicStore) => [s.address, s.city, s.wilaya, "Algeria"].join(", ")
const destination = (s: PublicStore) => (hasCoords(s) ? `${s.latitude},${s.longitude}` : fullAddress(s))
const directionsUrl = (s: PublicStore) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination(s))}`
const embedUrl = (s: PublicStore) => `https://www.google.com/maps?q=${encodeURIComponent(destination(s))}&z=15&output=embed`
const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`)

type Locate = { state: "idle" | "locating" | "done" | "error"; message?: string }

export function StoreFinder({ stores, findLabel = "Find the closest shop" }: { stores: PublicStore[]; findLabel?: string }) {
  const [selectedId, setSelectedId] = React.useState(stores[0]?.id ?? null)
  const [distances, setDistances] = React.useState<Record<number, number> | null>(null)
  const [locate, setLocate] = React.useState<Locate>({ state: "idle" })
  const canLocate = stores.some(hasCoords)

  const ordered = React.useMemo(() => {
    if (!distances) return stores
    return [...stores].sort((a, b) => (distances[a.id] ?? Infinity) - (distances[b.id] ?? Infinity))
  }, [stores, distances])
  const closestId = distances ? ordered.find((s) => distances[s.id] !== undefined)?.id : undefined
  const selected = stores.find((s) => s.id === selectedId) ?? stores[0]

  function findClosest() {
    if (!("geolocation" in navigator)) {
      setLocate({ state: "error", message: "Your browser can't share your location. Pick the shop in your wilaya below." })
      return
    }
    setLocate({ state: "locating" })
    // Your position stays in this browser — it is never sent to KING 253.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const next: Record<number, number> = {}
        for (const s of stores) if (hasCoords(s)) next[s.id] = distanceKm(me, { lat: s.latitude, lng: s.longitude })
        setDistances(next)
        const nearest = Object.entries(next).sort((a, b) => a[1] - b[1])[0]
        if (nearest) setSelectedId(Number(nearest[0]))
        setLocate({ state: "done" })
      },
      (err) =>
        setLocate({
          state: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission was refused. Pick the shop in your wilaya below."
              : "We couldn't get your location. Pick the shop in your wilaya below.",
        }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="king-label text-[0.6rem] text-king-gray">
            {stores.length} shop{stores.length > 1 ? "s" : ""} in Algeria
          </p>
          {canLocate && (
            <Button type="button" variant="king" size="lg" onClick={findClosest} disabled={locate.state === "locating"}>
              {locate.state === "locating" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
              {findLabel}
            </Button>
          )}
        </div>
        <p aria-live="polite" className={cn("mt-3 text-sm", locate.state === "error" ? "text-king-bright-red" : "text-king-gray")}>
          {locate.state === "error"
            ? locate.message
            : locate.state === "done" && closestId
              ? `Closest to you: ${stores.find((s) => s.id === closestId)?.name}.`
              : null}
        </p>

        <ul className="mt-4 grid gap-px bg-white/10">
          {ordered.map((s) => {
            const active = s.id === selected?.id
            const hours = parseHours(s.hours)
            return (
              <li key={s.id} className="bg-king-black">
                <article
                  className={cn(
                    "relative border-l-2 p-6 transition-colors md:p-7",
                    active ? "border-king-bright-red bg-king-near-black" : "border-transparent hover:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="king-display text-2xl text-king-white md:text-3xl">
                      <button type="button" onClick={() => setSelectedId(s.id)} aria-pressed={active} className="text-left after:absolute after:inset-0">
                        {s.name}
                      </button>
                    </h3>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {s.id === closestId && (
                        <span className="king-label bg-king-red px-2 py-1 text-[0.5rem] text-king-white">Closest</span>
                      )}
                      {distances?.[s.id] !== undefined && (
                        <span className="king-label text-[0.55rem] text-king-muted">≈ {formatKm(distances[s.id])}</span>
                      )}
                    </span>
                  </div>

                  <p className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-king-muted">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-king-bright-red" aria-hidden />
                    <span>
                      <span className="text-king-white">{s.address}</span>
                      <span className="block">
                        {s.city}, {s.wilaya}
                      </span>
                    </span>
                  </p>
                  {hours.length > 0 && (
                    <div className="mt-3 flex items-start gap-3 text-sm text-king-muted">
                      <Clock className="mt-0.5 size-4 shrink-0 text-king-bright-red" aria-hidden />
                      <ul className="w-full max-w-xs space-y-0.5">
                        {hours.map((h) => (
                          <li key={h.days} className="flex justify-between gap-6">
                            <span>{h.days}</span>
                            <span className="text-king-white">{h.time}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Links sit above the card-wide select button. */}
                  <div className="relative z-10 mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <a href={directionsUrl(s)} target="_blank" rel="noreferrer" className="king-label inline-flex items-center gap-2 text-[0.6rem] text-king-white hover:text-king-bright-red">
                      <Navigation className="size-3.5" aria-hidden /> Directions
                    </a>
                    {s.phone && (
                      <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="king-label inline-flex items-center gap-2 text-[0.6rem] text-king-muted hover:text-king-white">
                        <Phone className="size-3.5" aria-hidden /> {s.phone}
                      </a>
                    )}
                    {s.mapUrl && (
                      <a href={s.mapUrl} target="_blank" rel="noreferrer" className="king-label inline-flex items-center gap-2 text-[0.6rem] text-king-muted hover:text-king-white">
                        <ExternalLink className="size-3.5" aria-hidden /> Google Maps
                      </a>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </div>

      {selected && (
        <div className="lg:sticky lg:top-24 lg:col-span-7 lg:self-start">
          <div className="relative aspect-[4/3] overflow-hidden border border-white/10 bg-king-near-black lg:aspect-[16/11]">
            <iframe
              key={selected.id}
              title={`Map showing ${selected.name}, ${fullAddress(selected)}`}
              src={embedUrl(selected)}
              className="absolute inset-0 size-full grayscale invert-[0.92] contrast-[0.9]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-king-muted">
              <span className="block text-king-white">{selected.name}</span>
              {selected.address}, {selected.city}
            </p>
            <Button asChild variant="king" size="xl">
              <a href={directionsUrl(selected)} target="_blank" rel="noreferrer">
                <Navigation className="size-4" aria-hidden /> Get directions
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

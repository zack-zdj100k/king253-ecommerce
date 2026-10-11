/**
 * Shop closure ("vacation mode"). One rule, used by the storefront gate, the
 * checkout guard and the admin:
 *   closed ⇔ the closure is switched on
 *            AND it has started (no start date = right away)
 *            AND it has not ended (no end date = until the admin reopens).
 * When the end date passes the shop reopens by itself.
 */
export type ClosureSettings = { shopClosed: boolean; closedFrom: string; closedUntil: string; closedMessage?: string }

export type ClosureState =
  | { state: "open" }
  | { state: "closed"; until: Date | null }
  | { state: "scheduled"; from: Date; until: Date | null }

const toDate = (v: string) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function shopClosure(s: ClosureSettings, now = new Date()): ClosureState {
  if (!s.shopClosed) return { state: "open" }
  const from = toDate(s.closedFrom)
  const until = toDate(s.closedUntil)
  if (until && now >= until) return { state: "open" }
  if (from && now < from) return { state: "scheduled", from, until }
  return { state: "closed", until }
}

/** "Mon 14 Oct, 10:00" in Algeria's time zone. */
export function formatClosureDate(d: Date, locale = "en-GB") {
  return d.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" })
}

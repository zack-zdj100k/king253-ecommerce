/**
 * Algerian mobile numbers: 05/06/07 + 8 digits.
 * Accepts 0XXXXXXXXX, +213XXXXXXXXX, 00213XXXXXXXXX (spaces, dots, dashes ignored)
 * and returns E.164 (+2135XXXXXXXX), or null if invalid.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, "")
  const match = digits.match(/^(?:\+213|00213|213|0)([5-7]\d{8})$/)
  return match ? `+213${match[1]}` : null
}

/** +213550123456 → 0550 12 34 56 (display). */
export function formatPhone(e164: string): string {
  const local = e164.startsWith("+213") ? `0${e164.slice(4)}` : e164
  return local.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4")
}

/** wa.me link with an optional prefilled message. Never sends anything by itself. */
export function whatsappLink(e164: string, message?: string): string {
  const base = `https://wa.me/${e164.replace(/^\+/, "")}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

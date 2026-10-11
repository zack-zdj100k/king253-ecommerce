const ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "ONE SIZE", "OS"]

/** XS → S → M → L → XL …, numeric sizes ascending, anything else alphabetical. */
export function sortSizes(sizes: string[]) {
  const rank = (s: string) => {
    const i = ORDER.indexOf(s.toUpperCase())
    if (i >= 0) return i
    const n = Number.parseFloat(s)
    return Number.isFinite(n) ? 100 + n : 10_000
  }
  return [...new Set(sizes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

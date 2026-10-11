/** Prices are stored as whole Algerian dinars. */
export function formatDA(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "Price TBA"
  return `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount).replace(/ | /g, " ")} DA`
}

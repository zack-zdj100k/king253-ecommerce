/** Left-to-right isolate: keeps "8 600 DA" in order inside Arabic (RTL) text. Invisible otherwise. */
export const ltr = (text: string) => `⁦${text}⁩`

/** Prices are stored as whole Algerian dinars. */
export function formatDA(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "Price TBA"
  // fr-DZ groups thousands with a (narrow) no-break space; use a plain no-break space everywhere.
  return ltr(`${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount).replace(/[  ]/g, " ")} DA`)
}

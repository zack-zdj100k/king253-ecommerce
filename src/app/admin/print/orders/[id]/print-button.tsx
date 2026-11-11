"use client"

/** Opens the browser's print dialog (A4). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded bg-black px-4 py-2 text-sm font-bold text-white">
      Imprimer · طباعة
    </button>
  )
}

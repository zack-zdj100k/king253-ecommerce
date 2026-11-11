"use client"

import * as React from "react"
import { Languages, Loader2 } from "lucide-react"

import { translateAllProductsAction } from "@/app/admin/actions/products"
import { Panel, btnOutline } from "@/components/admin/ui"

/** Settings → automatic translation of product texts (Arabic, French, English). */
export function TranslationPanel({ ready }: { ready: boolean }) {
  const [pending, start] = React.useTransition()
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null)
  return (
    <Panel title="Product translation">
      <p className="text-sm text-king-muted">
        Write each product’s description once, in Arabic, French or English. When you save, it is translated automatically into the two other languages, and
        each visitor reads it in the language they chose.
      </p>
      <p className="mt-3 flex items-center gap-2 text-xs text-king-gray">
        <Languages className="size-3.5" aria-hidden />
        Translation service: {ready ? "active (DeepL)." : "not set up yet — products show the text as written. Add DEEPL_API_KEY to the server .env."}
      </p>
      <button
        type="button"
        className={`${btnOutline} mt-4`}
        disabled={pending || !ready}
        onClick={() =>
          start(async () => {
            setResult(null)
            const r = await translateAllProductsAction()
            setResult(r.ok ? { ok: true, text: String((r as { data?: unknown }).data ?? "Done.") } : { ok: false, text: r.error })
          })
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Translate every product now
      </button>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`mt-2 text-xs ${result.ok ? "text-emerald-400" : "text-king-bright-red"}`}>
          {result.text}
        </p>
      )}
    </Panel>
  )
}

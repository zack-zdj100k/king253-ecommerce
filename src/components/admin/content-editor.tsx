"use client"

import * as React from "react"
import { Check, ExternalLink, ImageIcon, Loader2, RotateCcw, Trash2, Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import { deleteMediaAction, listMediaAction, saveContentAction } from "@/app/admin/actions/site"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass, textareaClass } from "@/components/admin/ui"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ConfirmButton } from "@/components/admin/confirm-button"

type Field = { name: string; label: string; type: "text" | "textarea" | "lines" | "image"; help?: string }
type MediaItem = { url: string; uploaded: boolean; size: number | null; modified: string | null }

/**
 * One CMS section: text fields first, then its images. Empty = the approved
 * default copy (shown as the placeholder), so nothing changes until edited.
 */
export function ContentEditor({
  sectionKey,
  label,
  help,
  previewHref,
  fields,
  values,
  defaults,
}: {
  sectionKey: string
  label: string
  help?: string
  previewHref: string
  fields: Field[]
  values: Record<string, string>
  defaults: Record<string, string>
}) {
  const { run, pending, feedback, setFeedback } = useAdminAction()
  const [v, setV] = React.useState(values)
  const textFields = fields.filter((f) => f.type !== "image")
  const imageFields = fields.filter((f) => f.type === "image")
  const edited = Object.values(values).some((x) => x.trim() !== "")
  const dirty = fields.some((f) => (v[f.name] ?? "") !== (values[f.name] ?? ""))
  const set = (name: string, value: string) => setV((prev) => ({ ...prev, [name]: value }))

  return (
    <form
      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveContentAction(sectionKey, v))
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-king-white">
            {label}
            {edited ? (
              <span className="rounded-full bg-king-red/20 px-2 py-0.5 text-[0.65rem] font-medium text-king-white">Edited</span>
            ) : (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.65rem] font-medium text-king-gray">Default</span>
            )}
          </h3>
          {help && <p className="mt-1 text-xs text-king-gray">{help}</p>}
        </div>
        <a href={previewHref} target="_blank" rel="noreferrer" className={btnGhost}>
          <ExternalLink className="size-3.5" aria-hidden /> View on page
        </a>
      </header>

      <div className="space-y-5 p-5">
        {textFields.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {textFields.map((f) => (
              <label key={f.name} className={cn("block", f.type !== "text" && "md:col-span-2")}>
                <span className={labelClass}>{f.label}</span>
                {f.type === "text" ? (
                  <input value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} placeholder={defaults[f.name]} className={inputClass} />
                ) : (
                  <textarea
                    value={v[f.name] ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                    rows={Math.min(6, Math.max(3, (defaults[f.name] ?? "").split("\n").length + 1))}
                    placeholder={defaults[f.name]}
                    className={textareaClass}
                  />
                )}
                {f.help && <span className="mt-1 block text-xs text-king-gray">{f.help}</span>}
              </label>
            ))}
          </div>
        )}

        {imageFields.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {imageFields.map((f) => (
              <ImageField
                key={f.name}
                label={f.label}
                help={f.help}
                value={v[f.name] ?? ""}
                fallback={defaults[f.name] ?? ""}
                onChange={(url) => set(f.name, url)}
                onError={(text) => setFeedback({ tone: "error", text })}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] bg-black/20 px-5 py-3">
        <button type="submit" disabled={pending || !dirty} className={btnRed}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
          Save changes
        </button>
        <button type="button" onClick={() => setV(Object.fromEntries(fields.map((f) => [f.name, ""])))} className={btnGhost}>
          <RotateCcw className="size-3.5" aria-hidden /> Reset to default
        </button>
        {dirty && !pending && <span className="text-xs text-king-gray">Unsaved changes</span>}
        <Feedback feedback={feedback} />
      </footer>
    </form>
  )
}

async function uploadOne(file: File) {
  const form = new FormData()
  form.append("files", file)
  const res = await fetch("/api/admin/uploads", { method: "POST", body: form })
  const body = (await res.json().catch(() => ({}))) as { urls?: string[]; error?: string }
  if (!body.urls?.[0]) throw new Error(body.error ?? "Upload failed.")
  return body.urls[0]
}

/** Current image preview + Upload / Library / Use default. */
export function ImageField({
  label,
  help,
  value,
  fallback,
  onChange,
  onError,
}: {
  label: string
  help?: string
  value: string
  fallback: string
  onChange: (url: string) => void
  onError: (text: string) => void
}) {
  const [busy, setBusy] = React.useState(false)
  const [library, setLibrary] = React.useState(false)
  const shown = value || fallback
  const input = React.useRef<HTMLInputElement>(null)

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/30">
      <div className="relative aspect-[4/3] bg-white/[0.03]">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded file
          <img src={shown} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <ImageIcon className="absolute inset-0 m-auto size-6 text-king-gray" aria-hidden />
        )}
        <span
          className={cn(
            "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[0.65rem] font-medium backdrop-blur",
            value ? "bg-king-red/80 text-king-white" : "bg-black/60 text-king-muted"
          )}
        >
          {value ? "New image" : "Default"}
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-black/60">
            <Loader2 className="size-5 animate-spin text-king-white" aria-hidden />
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="text-xs font-medium text-king-white">{label}</p>
        {help && <p className="text-[0.7rem] text-king-gray">{help}</p>}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className={cn(btnOutline, "h-8 px-3 text-xs")}>
            <Upload className="size-3" aria-hidden /> Upload
          </button>
          <button type="button" onClick={() => setLibrary(true)} className={cn(btnOutline, "h-8 px-3 text-xs")}>
            <ImageIcon className="size-3" aria-hidden /> Library
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className={cn(btnGhost, "h-8 px-3 text-xs")}>
              Use default
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            setBusy(true)
            try {
              onChange(await uploadOne(file))
            } catch (err) {
              onError(err instanceof Error ? err.message : "Upload failed.")
            } finally {
              setBusy(false)
            }
          }}
        />
      </div>
      <MediaLibrary
        open={library}
        onOpenChange={setLibrary}
        current={shown}
        onPick={(url) => {
          onChange(url === fallback ? "" : url)
          setLibrary(false)
        }}
      />
    </div>
  )
}

/** Reuse an uploaded or built-in image; delete uploads nothing uses any more. */
function MediaLibrary({ open, onOpenChange, current, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; current: string; onPick: (url: string) => void }) {
  const [items, setItems] = React.useState<MediaItem[] | null>(null)
  const { run, pending, feedback, setFeedback } = useAdminAction()

  React.useEffect(() => {
    if (!open) return
    let alive = true
    listMediaAction()
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-3xl border-white/10 bg-[#101011] p-0 sm:max-w-4xl" data-lenis-prevent>
        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#101011]/95 px-6 py-4 backdrop-blur">
          <DialogTitle className="text-base font-semibold text-king-white">Image library</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-king-gray">
            Pick an image to reuse it. Uploads that nothing uses any more can be deleted.
          </DialogDescription>
          <div className="mt-2">
            <Feedback feedback={feedback} />
          </div>
        </div>
        <div className="p-6">
          {items === null ? (
            <Loader2 className="mx-auto size-6 animate-spin text-king-gray" aria-hidden />
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-king-gray">No images yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => (
                <li key={item.url} className={cn("group relative overflow-hidden rounded-xl border bg-black/30", item.url === current ? "border-king-bright-red" : "border-white/[0.08]")}>
                  <button type="button" onClick={() => onPick(item.url)} className="block w-full text-left" aria-label={`Use ${item.url}`}>
                    <span className="relative block aspect-[4/3]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                      <img src={item.url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    </span>
                    <span className="flex items-center justify-between gap-2 px-2.5 py-2 text-[0.65rem] text-king-gray">
                      <span>{item.uploaded ? (item.modified ? new Date(item.modified).toLocaleDateString("en-GB") : "Upload") : "Built-in"}</span>
                      {item.size ? <span>{Math.round(item.size / 1024)} KB</span> : null}
                    </span>
                  </button>
                  {item.url === current && (
                    <span className="absolute top-2 left-2 grid size-6 place-items-center rounded-full bg-king-red text-king-white">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                  )}
                  {item.uploaded && item.url !== current && (
                    <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <ConfirmButton
                        danger
                        disabled={pending}
                        confirm="Delete?"
                        confirmLabel="Yes"
                        onConfirm={() => {
                          setFeedback(null)
                          run(
                            () => deleteMediaAction(item.url),
                            () => setItems((list) => list?.filter((x) => x.url !== item.url) ?? null)
                          )
                        }}
                        ariaLabel="Delete image"
                        className="grid size-8 place-items-center rounded-full bg-black/70 text-king-muted hover:text-king-bright-red"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </ConfirmButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

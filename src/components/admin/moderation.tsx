"use client"

import * as React from "react"
import { Upload } from "lucide-react"

import {
  deleteReturnAction,
  deleteReviewAction,
  deleteTestimonialAction,
  moderateReviewAction,
  returnAction,
  saveTestimonialAction,
} from "@/app/admin/actions/moderation"
import { DeleteButton } from "@/components/admin/delete-button"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass, textareaClass } from "@/components/admin/ui"
import { ConfirmButton } from "@/components/admin/confirm-button"

export function ReviewActions({ id, status }: { id: string; status: string }) {
  const { run, pending, feedback } = useAdminAction()
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "approved" && (
        <button type="button" disabled={pending} onClick={() => run(() => moderateReviewAction(id, "approved"))} className={btnRed}>
          Approve
        </button>
      )}
      {status !== "rejected" && (
        <button type="button" disabled={pending} onClick={() => run(() => moderateReviewAction(id, "rejected"))} className={btnOutline}>
          Reject
        </button>
      )}
      <DeleteButton label="Delete" confirm="Delete review?" action={deleteReviewAction.bind(null, id)} />
      <Feedback feedback={feedback} />
    </div>
  )
}

type Testimonial = { id: string; quote: string; name: string; role: string | null; imageUrl: string | null; published: boolean; sortOrder: number }

export function TestimonialForm({ testimonial }: { testimonial: Testimonial | null }) {
  const { run, pending, feedback, setFeedback } = useAdminAction()
  const empty = { quote: "", name: "", role: "", imageUrl: "", published: false, sortOrder: 0 }
  const [v, setV] = React.useState(
    testimonial ? { ...testimonial, role: testimonial.role ?? "", imageUrl: testimonial.imageUrl ?? "" } : empty
  )
  const [uploading, setUploading] = React.useState(false)

  async function upload(file: File) {
    setUploading(true)
    const form = new FormData()
    form.append("files", file)
    const res = await fetch("/api/admin/uploads", { method: "POST", body: form })
    const body = (await res.json()) as { urls?: string[]; error?: string }
    setUploading(false)
    if (body.urls?.[0]) setV((s) => ({ ...s, imageUrl: body.urls![0] }))
    else setFeedback({ tone: "error", text: body.error ?? "Upload failed." })
  }

  return (
    <form
      className="space-y-3 border border-white/10 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveTestimonialAction(testimonial?.id ?? null, v), () => !testimonial && setV(empty))
      }}
    >
      <label className="block">
        <span className={labelClass}>Words (as the customer said them)</span>
        <textarea value={v.quote} onChange={(e) => setV({ ...v, quote: e.target.value })} rows={3} maxLength={600} className={textareaClass} />
      </label>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_80px]">
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Name" aria-label="Name" className={inputClass} />
        <input value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} placeholder="City / role (optional)" aria-label="Role" className={inputClass} />
        <input type="number" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })} aria-label="Order" className={inputClass} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className={btnOutline}>
          <Upload className="size-3.5" aria-hidden /> {uploading ? "Uploading…" : v.imageUrl ? "Change photo" : "Photo (optional)"}
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {v.imageUrl && (
          <button type="button" onClick={() => setV({ ...v, imageUrl: "" })} className={btnGhost}>
            Remove photo
          </button>
        )}
        <label className="flex items-center gap-2 text-sm text-king-muted">
          <input type="checkbox" checked={v.published} onChange={(e) => setV({ ...v, published: e.target.checked })} className="accent-[#a30d0d]" /> Published
        </label>
        <button type="submit" disabled={pending} className={btnRed}>{testimonial ? "Save" : "Add testimonial"}</button>
        {testimonial && (
          <ConfirmButton danger confirm="Delete this testimonial?" confirmLabel="Yes, delete" onConfirm={() => run(() => deleteTestimonialAction(testimonial.id))} className={btnGhost}>
            Delete
          </ConfirmButton>
        )}
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}

export function ReturnActions({ id, status, type }: { id: string; status: string; type: "return" | "exchange" }) {
  const { run, pending, feedback } = useAdminAction()
  const [note, setNote] = React.useState("")
  return (
    <div className="space-y-2">
      {(status === "requested" || status === "approved") && (
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" className={inputClass} />
      )}
      <div className="flex flex-wrap gap-2">
        {status === "requested" && (
          <button type="button" disabled={pending} onClick={() => run(() => returnAction(id, "approve", { note }))} className={btnRed}>
            Approve{type === "exchange" ? " & reserve replacement" : ""}
          </button>
        )}
        {(status === "requested" || status === "approved") && (
          <button type="button" disabled={pending} onClick={() => run(() => returnAction(id, "reject", { note }))} className={btnOutline}>
            Reject
          </button>
        )}
        {status === "approved" && (
          <>
            <button type="button" disabled={pending} onClick={() => run(() => returnAction(id, "receive", { condition: "resellable" }))} className={btnOutline}>
              Received — resellable (restock)
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => returnAction(id, "receive", { condition: "damaged" }))} className={btnOutline}>
              Received — damaged (no restock)
            </button>
          </>
        )}
        {status === "received" && (
          <button type="button" disabled={pending} onClick={() => run(() => returnAction(id, "complete"))} className={btnRed}>
            Complete{type === "exchange" ? " — replacement handed over" : ""}
          </button>
        )}
        <DeleteButton label="Delete" confirm={status === "approved" && type === "exchange" ? "Delete and release the replacement?" : "Delete request?"} action={deleteReturnAction.bind(null, id)} />
      </div>
      <Feedback feedback={feedback} />
    </div>
  )
}

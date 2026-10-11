"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

type Result = { ok: true; message?: string } | { ok: false; error: string }

/** Runs an admin Server Action with pending state, a feedback message and a refresh. */
export function useAdminAction() {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [feedback, setFeedback] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const run = React.useCallback(
    (action: () => Promise<Result>, onOk?: () => void) => {
      setFeedback(null)
      startTransition(async () => {
        const r = await action()
        if (r.ok) {
          setFeedback(r.message ? { tone: "ok", text: r.message } : null)
          onOk?.()
          router.refresh()
        } else setFeedback({ tone: "error", text: r.error })
      })
    },
    [router]
  )
  return { run, pending, feedback, setFeedback }
}

export function Feedback({ feedback }: { feedback: { tone: "ok" | "error"; text: string } | null }) {
  if (!feedback) return null
  return (
    <p role={feedback.tone === "error" ? "alert" : "status"} className={feedback.tone === "error" ? "text-sm text-king-bright-red" : "text-sm text-king-muted"}>
      {feedback.text}
    </p>
  )
}

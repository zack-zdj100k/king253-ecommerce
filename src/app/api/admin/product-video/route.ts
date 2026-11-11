import { NextResponse } from "next/server"

import { getCurrentUser } from "@/server/auth/session"
import { AppError } from "@/server/errors"
import { rateLimit } from "@/server/rate-limit"
import { MAX_VIDEO_BYTES, storeVideo } from "@/server/uploads"

/** Admin-only product video upload (one MP4/WebM, ≤ 25 MB). Returns { url }. */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Not allowed." }, { status: 403 })
  if (!rateLimit(`video:${user.id}`, 10, 60_000).ok) return NextResponse.json({ error: "Too many uploads, wait a minute." }, { status: 429 })
  // Refuse huge bodies before reading them.
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > MAX_VIDEO_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: `The video is too large — the limit is ${MAX_VIDEO_BYTES / 1048576} MB.` }, { status: 413 })
  }
  const form = await request.formData().catch(() => null)
  const file = form?.get("video")
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No video received." }, { status: 400 })
  try {
    return NextResponse.json({ url: await storeVideo(file) })
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.userMessage }, { status: 400 })
    console.error("[king253] video upload failed", error)
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 })
  }
}

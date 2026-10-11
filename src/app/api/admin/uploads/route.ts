import { NextResponse } from "next/server"

import { getCurrentUser } from "@/server/auth/session"
import { AppError } from "@/server/errors"
import { rateLimit } from "@/server/rate-limit"
import { MAX_FILES, storeImage } from "@/server/uploads"

/** Admin-only image upload. Returns { urls } of stored, re-encoded images. */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Not allowed." }, { status: 403 })
  if (!rateLimit(`upload:${user.id}`, 60, 60_000).ok) return NextResponse.json({ error: "Too many uploads, wait a minute." }, { status: 429 })

  const form = await request.formData().catch(() => null)
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return NextResponse.json({ error: "No image received." }, { status: 400 })
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Upload at most ${MAX_FILES} images at a time.` }, { status: 400 })

  try {
    const urls: string[] = []
    for (const file of files) urls.push(await storeImage(file))
    return NextResponse.json({ urls })
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.userMessage }, { status: 400 })
    console.error("[king253] upload failed", error)
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 })
  }
}

import { createReadStream } from "node:fs"
import { Readable } from "node:stream"

import { openMedia } from "@/server/uploads"

/**
 * Serves uploaded images and product videos. Files are content-addressed (uuid) so they cache forever.
 * Streams from disk and answers HTTP Range requests — phones (Safari especially) need that to play and seek videos.
 */
export async function GET(request: Request, { params }: RouteContext<"/media/[...path]">) {
  const { path } = await params
  const file = await openMedia(path)
  if (!file) return new Response("Not found", { status: 404 })

  const base = {
    "Content-Type": file.type,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  }
  const range = request.headers.get("range")
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    let start = m && m[1] !== "" ? Number(m[1]) : NaN
    let end = m && m[2] !== "" ? Number(m[2]) : NaN
    if (m && Number.isNaN(start) && !Number.isNaN(end)) {
      // "bytes=-500": the last 500 bytes
      start = Math.max(0, file.size - end)
      end = file.size - 1
    } else if (m && !Number.isNaN(start) && Number.isNaN(end)) {
      end = file.size - 1
    }
    if (!m || Number.isNaN(start) || Number.isNaN(end) || start > end || start >= file.size) {
      return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${file.size}` } })
    }
    end = Math.min(end, file.size - 1)
    return new Response(Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${file.size}`, "Content-Length": String(end - start + 1) },
    })
  }
  return new Response(Readable.toWeb(createReadStream(file.path)) as ReadableStream, { headers: { ...base, "Content-Length": String(file.size) } })
}

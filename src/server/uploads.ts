import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, stat, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

import { AppError } from "./errors"

export const UPLOAD_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads"))
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_FILES = 12
/** One product video: MP4 (H.264) or WebM, at most 25 MB. Ideal: 10–20 s, 720p, under 10 MB. */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024

/** Detect the real type from magic bytes — never trust the filename or browser MIME. */
function sniff(buf: Buffer): "jpeg" | "png" | "webp" | "avif" | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg"
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png"
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp"
  if (buf.toString("ascii", 4, 8) === "ftyp" && /avi[fs]/.test(buf.toString("ascii", 8, 12))) return "avif"
  return null
}

/** Re-encodes to WebP (strips metadata/any embedded payload), max 2400px. Returns the public /media URL. */
export async function storeImage(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("TOO_LARGE", `${file.name} is larger than 10 MB.`)
  const buf = Buffer.from(await file.arrayBuffer())
  if (!sniff(buf)) throw new AppError("BAD_TYPE", `${file.name} is not a JPEG, PNG, WebP or AVIF image.`)

  let output: Buffer
  try {
    output = await sharp(buf, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer()
  } catch {
    throw new AppError("BAD_IMAGE", `${file.name} could not be read as an image.`)
  }

  const now = new Date()
  const dir = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"))
  const name = `${randomUUID()}.webp`
  await mkdir(path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, dir), { recursive: true })
  await writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, dir, name), output)
  return `/media/${dir}/${name}`
}

/* ------------------------------------------------------------------ */
/* Product video                                                      */
/* ------------------------------------------------------------------ */

const MP4_BRANDS = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "M4VH", "M4VP", "MSNV", "dash", "f4v ", "3gp4", "3gp5"])

/** Real type from the first bytes — never the file name or the browser's MIME type. */
export function sniffVideo(buf: Buffer): "mp4" | "webm" | null {
  if (buf.length < 16) return null
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm"
  if (buf.toString("ascii", 4, 8) === "ftyp" && MP4_BRANDS.has(buf.toString("ascii", 8, 12))) return "mp4"
  return null
}

/** Why a video can't be used (null = fine). HEVC/H.265 plays on iPhones but not on many Android phones and PCs. */
export function videoProblem(buf: Buffer): string | null {
  if (buf.toString("ascii", 4, 8) === "ftyp" && buf.toString("ascii", 8, 12) === "qt  ") {
    return "This is an iPhone/QuickTime (.mov) video. Export it as MP4 (H.264): on iPhone use Settings → Camera → Formats → Most Compatible, or convert it with any free video converter."
  }
  const kind = sniffVideo(buf)
  if (!kind) return "Only MP4 (H.264) or WebM videos are accepted."
  if (kind === "mp4" && (buf.includes("hvc1") || buf.includes("hev1"))) {
    return "This video uses HEVC (H.265), which many phones and browsers cannot play. Export it as MP4 with H.264."
  }
  return null
}

export function videoUrlOk(url: string | null | undefined): url is string {
  return !!url && /^(\/media\/videos\/[\w/-]+\.(mp4|webm)|https:\/\/[^\s]+\.(mp4|webm)(\?[^\s]*)?)$/i.test(url)
}

/** Stores one product video (already size-limited by the caller's Content-Length check). Returns its /media URL. */
export async function storeVideo(file: File): Promise<string> {
  if (file.size === 0) throw new AppError("EMPTY", "No video received.")
  if (file.size > MAX_VIDEO_BYTES) throw new AppError("TOO_LARGE", `The video is ${(file.size / 1048576).toFixed(1)} MB — the limit is ${MAX_VIDEO_BYTES / 1048576} MB. Shorten it or lower its quality.`)
  const buf = Buffer.from(await file.arrayBuffer())
  const problem = videoProblem(buf)
  if (problem) throw new AppError("BAD_VIDEO", problem)
  const ext = sniffVideo(buf) === "webm" ? "webm" : "mp4"
  const now = new Date()
  const dir = path.join("videos", String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"))
  const name = `${randomUUID()}.${ext}`
  await mkdir(path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, dir), { recursive: true })
  await writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, dir, name), buf)
  return `/media/${dir.split(path.sep).join("/")}/${name}`
}

/** Removes an uploaded video file (only inside the uploads folder, only /media/videos/…). */
export async function removeVideoFile(url: string | null | undefined) {
  const m = url?.match(/^\/media\/(videos\/[\w/-]+\.(?:mp4|webm))$/i)
  if (!m) return
  const file = path.resolve(/*turbopackIgnore: true*/ UPLOAD_ROOT, m[1])
  if (!file.startsWith(UPLOAD_ROOT + path.sep)) return
  await unlink(file).catch(() => {})
}

const TYPES: Record<string, string> = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm" }

/** Resolves a /media path safely inside UPLOAD_ROOT (no traversal). Returns the file to stream. */
export async function openMedia(segments: string[]) {
  const resolved = path.resolve(/*turbopackIgnore: true*/ UPLOAD_ROOT, ...segments)
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return null
  const type = TYPES[path.extname(resolved).toLowerCase()]
  if (!type) return null
  try {
    const info = await stat(resolved)
    if (!info.isFile()) return null
    return { path: resolved, size: info.size, type }
  } catch {
    return null
  }
}

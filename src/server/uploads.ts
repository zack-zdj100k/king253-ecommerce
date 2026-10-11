import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

import { AppError } from "./errors"

export const UPLOAD_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads"))
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_FILES = 12

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

const TYPES: Record<string, string> = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".avif": "image/avif" }

/** Resolves a /media path safely inside UPLOAD_ROOT (no traversal). */
export async function readMedia(segments: string[]) {
  const resolved = path.resolve(/*turbopackIgnore: true*/ UPLOAD_ROOT, ...segments)
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return null
  const type = TYPES[path.extname(resolved).toLowerCase()]
  if (!type) return null
  try {
    const info = await stat(resolved)
    if (!info.isFile()) return null
    return { body: await readFile(resolved), type }
  } catch {
    return null
  }
}

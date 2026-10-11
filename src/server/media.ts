import "server-only"

import { readdir, stat, unlink } from "node:fs/promises"
import path from "node:path"

import { sql } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { AppError } from "./errors"
import { UPLOAD_ROOT } from "./uploads"
import { IMAGES } from "@/lib/site"

export type MediaItem = { url: string; uploaded: boolean; size: number | null; modified: string | null }

/** Uploaded images (newest first) followed by the built-in campaign images. */
export async function listMedia(): Promise<MediaItem[]> {
  const found: MediaItem[] = []
  async function walk(dir: string, rel: string[]) {
    let entries
    try {
      entries = await readdir(path.join(/*turbopackIgnore: true*/ dir), { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) await walk(path.join(/*turbopackIgnore: true*/ dir, entry.name), [...rel, entry.name])
      else if (/\.(webp|jpe?g|png|avif)$/i.test(entry.name)) {
        const info = await stat(path.join(/*turbopackIgnore: true*/ dir, entry.name))
        found.push({ url: `/media/${[...rel, entry.name].join("/")}`, uploaded: true, size: info.size, modified: info.mtime.toISOString() })
      }
    }
  }
  await walk(UPLOAD_ROOT, [])
  found.sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""))
  const builtIn = [...new Set(Object.values(IMAGES))].map((url) => ({ url, uploaded: false, size: null, modified: null }))
  return [...found, ...builtIn]
}

/** Where an image is still used — products, past orders, testimonials, page content. */
export async function mediaUsage(db: DbOrTx, url: string) {
  const [row] = (await db.execute(sql`
    select
      (select count(*) from product_images where url = ${url})::int as product_photos,
      (select count(*) from products where og_image_url = ${url})::int as share_images,
      (select count(*) from order_items where image_url = ${url})::int as order_items,
      (select count(*) from testimonials where image_url = ${url})::int as testimonials,
      (select count(*) from content_blocks where data::text like ${`%${url.replace(/[\\%_]/g, (c) => `\\${c}`)}%`})::int as page_sections
  `)) as unknown as { product_photos: number; share_images: number; order_items: number; testimonials: number; page_sections: number }[]
  return row
}

/** Deletes an uploaded file only when nothing references it any more. */
export async function deleteMedia(db: DbOrTx, url: string) {
  const m = url.match(/^\/media\/((?:[\w-]+\/)*[\w-]+\.(?:webp|jpe?g|png|avif))$/i)
  if (!m) throw new AppError("NOT_DELETABLE", "Only uploaded images can be deleted.")
  const usage = await mediaUsage(db, url)
  const uses = Object.entries(usage).filter(([, n]) => n > 0)
  if (uses.length) {
    const labels: Record<string, string> = {
      product_photos: "product photos",
      share_images: "product share images",
      order_items: "past orders",
      testimonials: "testimonials",
      page_sections: "page content",
    }
    throw new AppError("MEDIA_IN_USE", `Still used by ${uses.map(([k, n]) => `${n} ${labels[k]}`).join(", ")}. Replace it there first.`)
  }
  const file = path.resolve(/*turbopackIgnore: true*/ UPLOAD_ROOT, m[1])
  if (!file.startsWith(UPLOAD_ROOT + path.sep)) throw new AppError("NOT_DELETABLE", "Only uploaded images can be deleted.")
  try {
    await unlink(file)
  } catch {
    throw new AppError("NOT_FOUND", "This image was already removed.")
  }
}

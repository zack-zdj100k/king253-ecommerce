import Image from "next/image"

import { cn } from "@/lib/utils"

/** Image + focal point/zoom (from product_images) used to crop a garment out of campaign shots. */
export type Crop = { url: string; focusX: number; focusY: number; zoom: number; alt?: string | null }

/** Wide campaign shots are 16:9; uploads are whatever they are — portrait assumed unless known wide. */
const WIDE = /\/images\/hero\/[2-5]\.jpg$/

export function ProductImage({
  image,
  sizes,
  className,
  alt,
  preload,
}: {
  image: Crop | null
  sizes: string
  className?: string
  alt?: string
  preload?: boolean
}) {
  if (!image) return <div className={cn("absolute inset-0 bg-king-surface-light", className)} aria-hidden />
  const origin = `${image.focusX}% ${image.focusY}%`
  return (
    <Image
      src={image.url}
      alt={alt ?? image.alt ?? ""}
      fill
      sizes={sizes}
      preload={preload}
      className={cn("object-cover", className)}
      style={{ objectPosition: origin, transformOrigin: origin, scale: String(image.zoom) }}
    />
  )
}

/**
 * Responsive `sizes` for a 4:5 frame. A landscape source fills the frame by
 * height (≈2.24× its width) and zoom enlarges it further — both must be
 * included or the browser downloads a file too small to stay sharp.
 * `base` is the frame width in vw at [mobile, tablet, desktop].
 */
export function productSizes(image: Crop | null, base: [number, number, number]) {
  const factor = (image?.zoom ?? 1) * (image && WIDE.test(image.url) ? 2.24 : 1)
  const [mobile, tablet, desktop] = base.map((vw) => Math.round(vw * factor))
  return `(min-width: 1024px) ${desktop}vw, (min-width: 768px) ${tablet}vw, ${mobile}vw`
}

"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ProductImage, productSizes, type Crop } from "@/components/shop/product-image"
import { imagesForColour, useProductSelection } from "@/components/shop/variant-picker"

type GalleryImage = Crop & { color?: string | null }

/** Shows the selected colour's photos (then the shared ones); restarts at photo 1 on colour change. */
export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const colour = useProductSelection()?.colour ?? null
  const shown = imagesForColour(images, colour)
  return <Gallery key={colour ?? "all"} images={shown} name={colour ? `${name} — ${colour}` : name} />
}

/** Gallery: hover-zoom on desktop, swipe on mobile, fullscreen viewer. */
function Gallery({ images, name }: { images: Crop[]; name: string }) {
  const [active, setActive] = React.useState(0)
  const [zoom, setZoom] = React.useState<{ x: number; y: number } | null>(null)
  const [fullscreen, setFullscreen] = React.useState(false)
  const stripRef = React.useRef<HTMLDivElement>(null)

  if (!images.length) {
    return <div className="king-chamfer aspect-[4/5] bg-king-surface-light [--cut:22px]" aria-hidden />
  }
  const go = (i: number) => {
    const next = (i + images.length) % images.length
    setActive(next)
    stripRef.current?.children[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }

  return (
    <div className="animate-in duration-300 fade-in-0 motion-reduce:animate-none lg:sticky lg:top-24">
      {/* Mobile: swipeable strip */}
      <div
        ref={stripRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget
          const slide = el.firstElementChild as HTMLElement | null
          if (!slide) return
          // Slides are narrower than the screen (the next photo peeks in), so step = slide + gap.
          const i = Math.min(images.length - 1, Math.round(el.scrollLeft / (slide.offsetWidth + 12)))
          if (i !== active) setActive(i)
        }}
        aria-label={`${name} photos`}
      >
        {images.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            onClick={() => setFullscreen(true)}
            className={cn(
              "relative aspect-[4/5] shrink-0 snap-center overflow-hidden bg-king-card",
              images.length > 1 ? "w-[78%] sm:w-[46%] md:w-[40%]" : "mx-auto w-[86%] sm:w-[56%] md:w-[48%]"
            )}
            aria-label={`Open photo ${i + 1} of ${images.length} full screen`}
          >
            <ProductImage image={img} alt={img.alt ?? name} sizes={productSizes(img, [80, 46, 50])} preload={i === 0} />
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5 lg:hidden" aria-hidden>
          {images.map((img, i) => (
            <span key={`${img.url}-dot-${i}`} className={cn("h-[2px] transition-all", i === active ? "w-6 bg-king-bright-red" : "w-2 bg-white/25")} />
          ))}
        </div>
      )}

      {/* Desktop: main frame with hover zoom + thumbnails */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[72px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {images.map((img, i) => (
            <button
              key={`${img.url}-thumb-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "king-chamfer relative aspect-[4/5] overflow-hidden bg-king-card [--cut:8px] transition-opacity",
                i === active ? "opacity-100 ring-1 ring-king-bright-red" : "opacity-50 hover:opacity-90"
              )}
            >
              <ProductImage image={img} alt="" sizes="120px" />
            </button>
          ))}
        </div>
        <div
          className="king-chamfer group relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-king-card [--cut:22px]"
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return
            const r = e.currentTarget.getBoundingClientRect()
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
          }}
          onPointerLeave={() => setZoom(null)}
          onClick={() => setFullscreen(true)}
        >
          <div
            className="absolute inset-0 transition-transform duration-300 ease-out"
            style={zoom ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          >
            <ProductImage image={images[active]} alt={images[active].alt ?? name} sizes={productSizes(images[active], [100, 100, 60])} preload />
          </div>
          <span className="king-label pointer-events-none absolute right-4 bottom-4 flex items-center gap-2 bg-black/50 px-3 py-2 text-[0.55rem] text-king-white backdrop-blur">
            <Expand className="size-3" aria-hidden /> Hover to zoom · click for full screen
          </span>
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent
          showCloseButton={false}
          className="h-[100svh] w-screen max-w-none rounded-none border-0 bg-black/95 p-0 sm:max-w-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(active + 1)
            if (e.key === "ArrowLeft") go(active - 1)
          }}
        >
          <DialogTitle className="sr-only">{name} — photo {active + 1}</DialogTitle>
          <DialogDescription className="sr-only">Use the arrow keys to browse photos.</DialogDescription>
          <div className="relative h-full w-full">
            <ProductImage image={{ ...images[active], zoom: 1 }} alt={images[active].alt ?? name} sizes="100vw" className="!object-contain" />
          </div>
          <DialogClose className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white/10 text-king-white hover:bg-white/20" aria-label="Close">
            <X className="size-5" />
          </DialogClose>
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => go(active - 1)} aria-label="Previous photo" className="absolute top-1/2 left-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-king-white hover:bg-white/20">
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" onClick={() => go(active + 1)} aria-label="Next photo" className="absolute top-1/2 right-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-king-white hover:bg-white/20">
                <ChevronRight className="size-5" />
              </button>
              <p className="king-label absolute bottom-5 left-1/2 -translate-x-1/2 text-[0.6rem] text-king-muted">
                {active + 1} / {images.length}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

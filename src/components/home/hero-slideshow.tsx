"use client"

import { useTranslations } from "next-intl"

import * as React from "react"
import Image from "next/image"
import { Pause, Play } from "lucide-react"

import { cn } from "@/lib/utils"
import { IMAGES } from "@/lib/site"
import { useReducedMotion } from "@/lib/use-reduced-motion"

const SLIDE_MS = 6500

/** Focal points keep each model in frame: `mobile` for full-bleed portrait, `desktop` for the right-hand panel. */
const DEFAULT_SLIDES = [
  {
    src: IMAGES.studio02,
    alt: "Model in a distressed black bomber, grey collegiate tee and black cargo pants in front of the KING 253 brick wall",
    mobile: "50% 50%",
    desktop: "50% 50%",
  },
  {
    src: IMAGES.studio03,
    alt: "Model in a washed varsity jacket and charcoal cargo pants under red studio spotlights",
    mobile: "68% 50%",
    desktop: "66% 50%",
  },
  {
    src: IMAGES.studio04,
    alt: "Model in a canvas work jacket, graphic tee and cargo denim beside black and red barrels",
    mobile: "64% 50%",
    desktop: "62% 50%",
  },
  {
    src: IMAGES.studio05,
    alt: "Model standing in front of brushed-steel KING 253 letters on a red-lit brick wall",
    mobile: "64% 50%",
    desktop: "56% 50%",
  },
] as const

/** Admin-chosen images keep the tuned framing when they are the defaults; new uploads are centred. */
function toSlides(urls: string[] | undefined) {
  if (!urls?.length) return [...DEFAULT_SLIDES]
  return urls.filter(Boolean).map((src, i) => {
    const known = DEFAULT_SLIDES.find((s) => s.src === src)
    return known ?? { src, alt: `KING 253 campaign look ${i + 1}`, mobile: "50% 50%", desktop: "50% 50%" }
  })
}

/** The campaign images in order (Hero needs the count to size its scroll). */
export function heroSlideCount(slides?: string[]) {
  return toSlides(slides).length
}

export function HeroSlideshow({
  className,
  mediaClassName,
  slides,
  index: controlled,
  onSelect,
}: {
  className?: string
  mediaClassName?: string
  slides?: string[]
  /** Scroll-driven mode: the parent picks the slide (no timer, no pause button). */
  index?: number
  /** Scroll-driven mode: a number was clicked — the parent scrolls to that photo. */
  onSelect?: (i: number) => void
}) {
  const t = useTranslations("home")
  const SLIDES = toSlides(slides)
  const scrollDriven = controlled !== undefined
  const [ownIndex, setIndex] = React.useState(0)
  const index = scrollDriven ? Math.min(controlled, SLIDES.length - 1) : ownIndex
  // Highest slide allowed to load: the current one plus the next, so the
  // full-resolution campaign images arrive one at a time.
  const [loadUpTo, setLoadUpTo] = React.useState(1)
  const [userPaused, setUserPaused] = React.useState<boolean | null>(null)
  const reducedMotion = useReducedMotion()
  const paused = scrollDriven || (userPaused ?? reducedMotion)

  // Scroll-driven: keep the image after the one on screen loading ahead.
  /* eslint-disable react-hooks/set-state-in-effect -- preload follows the parent's index */
  React.useEffect(() => {
    if (scrollDriven) setLoadUpTo((n) => Math.max(n, index + 1))
  }, [scrollDriven, index])
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    if (paused) return
    const id = window.setTimeout(() => goTo((index + 1) % SLIDES.length), SLIDE_MS)
    return () => window.clearTimeout(id)
  }, [index, paused, SLIDES.length])

  function goTo(i: number) {
    if (scrollDriven) return onSelect?.(i)
    setIndex(i)
    setLoadUpTo((n) => Math.max(n, i + 1))
  }

  return (
    <div className={cn("absolute inset-0", className)}>
      {/* Mask/offset and the entry scale live on separate elements: Chromium
          stops painting a masked element that also carries a GSAP transform. */}
      <div
        className={cn("absolute inset-0", mediaClassName)}
        aria-roledescription="carousel"
        aria-label={t("looks")}
      >
        <div data-hero-media className="absolute inset-0">
          {SLIDES.map((slide, i) => {
            const active = i === index
            return (
              <div
                key={`${slide.src}-${i}`}
                aria-hidden={!active}
                className={cn(
                  "absolute inset-0 transition-opacity ease-king motion-reduce:duration-500",
                  scrollDriven ? "duration-700" : "duration-[1600ms]",
                  active ? "opacity-100" : "opacity-0"
                )}
              >
                <div
                  className={cn(
                    "absolute inset-0 transition-transform duration-[7000ms] ease-out motion-reduce:transition-none",
                    active ? "scale-100" : "scale-[1.06] motion-reduce:scale-100"
                  )}
                >
                  {i <= loadUpTo && (
                    <Image
                      src={slide.src}
                      alt={t("lookAlt", { n: i + 1 })}
                      fill
                      quality={90}
                      preload={i === 0}
                      sizes="(min-width: 1024px) 100vw, 1600px"
                      style={{ "--pos-m": slide.mobile, "--pos-d": slide.desktop } as React.CSSProperties}
                      className="object-cover object-[var(--pos-m)] lg:object-[var(--pos-d)]"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Slide controls */}
      <div
        data-hero-reveal
        data-hero-meta
        className="absolute top-20 right-4 z-20 flex items-center gap-4 sm:right-6 lg:top-auto lg:right-12 lg:bottom-10"
      >
        <ol className="flex items-center gap-2" aria-label={t("chooseLook")}>
          {SLIDES.map((slide, i) => (
            <li key={`${slide.src}-${i}`}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={t("lookOf", { n: i + 1, total: SLIDES.length })}
                aria-current={i === index}
                className="group flex h-11 flex-col justify-center gap-2"
              >
                <span
                  className={cn(
                    "king-label text-left text-[0.625rem] transition-colors duration-300",
                    i === index ? "text-king-white" : "text-king-gray group-hover:text-king-muted"
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="relative block h-px w-8 overflow-hidden bg-white/20 sm:w-12">
                  {i === index && (
                    <span
                      key={`${index}-${paused}`}
                      className="absolute inset-0 origin-left bg-king-bright-red"
                      style={{
                        animation: paused ? undefined : `king-progress ${SLIDE_MS}ms linear forwards`,
                        transform: paused ? "scaleX(1)" : undefined,
                      }}
                    />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {!scrollDriven && (
        <button
          type="button"
          onClick={() => setUserPaused(!paused)}
          aria-label={paused ? t("play") : t("pause")}
          className="grid size-11 place-items-center border border-white/15 text-king-muted transition-colors duration-300 hover:border-white/40 hover:text-king-white"
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
        )}
      </div>
    </div>
  )
}

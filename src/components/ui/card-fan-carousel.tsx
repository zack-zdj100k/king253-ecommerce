"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { gsap } from "@/lib/gsap"

export interface CardItem {
  imgUrl: string
  alt?: string
  linkUrl?: string
  /** Focal point (percent) and zoom used to crop the image inside the card. */
  focus?: { x: number; y: number }
  zoom?: number
  /** Responsive `sizes` for next/image. */
  sizes?: string
  /** Overlay copy shown at the foot of the card. */
  title?: string
  meta?: string
  /** Makes the card a button instead of a link. */
  onSelect?: () => void
}

interface CardFanCarouselProps {
  cards: CardItem[]
  label?: string
  className?: string
  onCenterChange?: (index: number) => void
}

const MAX_VISIBLE = 7
const HALF = 3

const FAN_POSITIONS = [
  { rot: -21, scale: 0.7756, x: -30, y: 7.3, zIndex: 1 },
  { rot: -14, scale: 0.8498, x: -22, y: 4.0, zIndex: 2 },
  { rot: -7, scale: 0.9346, x: -11, y: 1.3, zIndex: 3 },
  { rot: 0, scale: 1.0, x: 0, y: 0.0, zIndex: 10 },
  { rot: 7, scale: 0.9346, x: 11, y: 1.3, zIndex: 3 },
  { rot: 14, scale: 0.8498, x: 22, y: 4.0, zIndex: 2 },
  { rot: 21, scale: 0.7756, x: 30, y: 7.3, zIndex: 1 },
]

function getResponsiveMultiplier(width: number) {
  if (width < 480) return 0.28
  if (width < 640) return 0.38
  if (width < 768) return 0.5
  if (width < 1024) return 0.75
  return 1.0
}

/** Shrinks vertical offsets when the viewport is shorter than the ideal fan height (matches `.fan-layout`). */
function getHeightMultiplier(width: number) {
  let idealPx: number
  if (width < 480) idealPx = 22 * 16
  else if (width < 640) idealPx = 26 * 16
  else if (width < 768) idealPx = 28 * 16
  else if (width < 1024) idealPx = 34 * 16
  else idealPx = 38 * 16

  const available = window.innerHeight * 0.7
  return available >= idealPx ? 1 : available / idealPx
}

function getSlotConfig(totalCards: number, slot: number) {
  if (totalCards >= MAX_VISIBLE) return FAN_POSITIONS[slot]
  const center = totalCards >> 1
  const distance = totalCards > 1 ? (slot - center) / center : 0
  const absDistance = Math.abs(distance)
  return {
    rot: distance * 21,
    scale: 1.0 - 0.2244 * absDistance * absDistance,
    x: distance * 30,
    y: absDistance * absDistance * 7.3,
    zIndex: 10 - Math.abs(slot - center),
  }
}

const ARROW_CLASSES =
  "relative grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-king-muted outline-none transition-colors duration-300 hover:border-king-bright-red hover:text-king-white focus-visible:border-king-bright-red active:opacity-70 md:size-12"

export default function CardFanCarousel({ cards, label = "Cards", className, onCenterChange }: CardFanCarouselProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const isAnimating = React.useRef(false)
  const hasEntered = React.useRef(false)
  const directionRef = React.useRef<"left" | "right" | null>(null)
  const prevVisible = React.useRef<Set<number>>(new Set())
  const [inView, setInView] = React.useState(false)

  const totalCards = cards.length
  const needsPagination = totalCards > MAX_VISIBLE
  const [centerIndex, setCenterIndex] = React.useState(needsPagination ? HALF : totalCards >> 1)

  React.useEffect(() => {
    onCenterChange?.(centerIndex)
  }, [centerIndex, onCenterChange])

  // Deal the cards in only once the fan scrolls into view.
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const getVisibleMap = React.useCallback(
    (center: number) => {
      const map = new Map<number, number>()
      if (!needsPagination) {
        for (let i = 0; i < totalCards; i++) map.set(i, i)
        return map
      }
      for (let slot = 0; slot < MAX_VISIBLE; slot++) {
        map.set((((center + slot - HALF) % totalCards) + totalCards) % totalCards, slot)
      }
      return map
    },
    [totalCards, needsPagination]
  )

  const cycle = React.useCallback(
    (direction: "left" | "right") => {
      if (isAnimating.current || !needsPagination) return
      isAnimating.current = true
      directionRef.current = direction
      setCenterIndex((prev) =>
        direction === "right" ? (prev + 1) % totalCards : (prev - 1 + totalCards) % totalCards
      )
    },
    [totalCards, needsPagination]
  )

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !totalCards) return

    const cardElements = Array.from(container.querySelectorAll<HTMLElement>(".fan-card"))
    if (!cardElements.length) return

    // Hold the stack hidden until the section is on screen.
    if (!inView) {
      gsap.set(cardElements, { opacity: 0 })
      return
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const dur = (s: number) => (reduceMotion ? 0 : s)

    const visibleMap = getVisibleMap(centerIndex)
    const previouslyVisible = prevVisible.current
    const direction = directionRef.current
    const isFirstMount = !hasEntered.current
    const multiplier = getResponsiveMultiplier(window.innerWidth)
    const hMult = getHeightMultiplier(window.innerWidth)
    const slotCount = needsPagination ? MAX_VISIBLE : totalCards
    const config = (slot: number) => getSlotConfig(slotCount, slot)

    if (isFirstMount) isAnimating.current = true

    let completedCount = 0
    const visibleCount = visibleMap.size
    const onCardDone = () => {
      if (++completedCount >= visibleCount) {
        isAnimating.current = false
        if (isFirstMount) hasEntered.current = true
      }
    }

    cardElements.forEach((card, cardIndex) => {
      const slot = visibleMap.get(cardIndex)
      const wasVisible = previouslyVisible.has(cardIndex)

      if (slot !== undefined) {
        const { x, y, rot, scale, zIndex } = config(slot)
        const target = { x: `${x * multiplier}rem`, y: `${y * hMult}rem`, rotation: rot, scale, opacity: 1, zIndex }
        card.removeAttribute("inert")

        if (isFirstMount) {
          gsap.set(card, { x: 0, y: `${12 * hMult}rem`, rotation: 0, scale: 0.5, opacity: 0 })
          gsap.to(card, {
            ...target,
            duration: dur(1.2),
            ease: "elastic.out(1.05,.78)",
            delay: reduceMotion ? 0 : 0.2 + slot * 0.06,
            overwrite: true,
            onComplete: onCardDone,
          })
        } else if (!wasVisible) {
          const enterX = direction === "right" ? 40 : -40
          gsap.set(card, {
            x: `${enterX}rem`,
            y: `${y * hMult}rem`,
            rotation: direction === "right" ? 30 : -30,
            scale: 0.5,
            opacity: 0,
          })
          gsap.to(card, { ...target, duration: dur(0.6), ease: "power2.out", overwrite: true, onComplete: onCardDone })
        } else {
          gsap.to(card, { ...target, duration: dur(0.5), ease: "power2.out", overwrite: true, onComplete: onCardDone })
        }
      } else {
        card.setAttribute("inert", "")
        if (wasVisible) {
          const exitX = direction === "right" ? -40 : 40
          gsap.to(card, {
            x: `${exitX}rem`,
            opacity: 0,
            scale: 0.5,
            rotation: direction === "right" ? -30 : 30,
            duration: dur(0.4),
            ease: "power2.in",
            zIndex: 0,
            overwrite: true,
          })
        } else if (isFirstMount) {
          gsap.set(card, { opacity: 0, scale: 0.3, x: 0, y: 0, zIndex: 0 })
        }
      }
    })

    prevVisible.current = new Set(visibleMap.keys())

    if (reduceMotion) return

    // Hover / focus: lift the active card and push its neighbours apart.
    const visibleEntries: { el: HTMLElement; slot: number }[] = []
    cardElements.forEach((el, i) => {
      const slot = visibleMap.get(i)
      if (slot !== undefined) visibleEntries.push({ el, slot })
    })
    visibleEntries.sort((a, b) => a.slot - b.slot)

    let activeSlot: number | null = null
    let leaveTimer: ReturnType<typeof setTimeout> | null = null
    const centerSlot = visibleEntries.length >> 1

    const updateHoverLayout = (hoveredSlot: number | null) => {
      const mult = getResponsiveMultiplier(window.innerWidth)
      const hM = getHeightMultiplier(window.innerWidth)

      visibleEntries.forEach(({ el, slot }) => {
        const base = config(slot)
        let targetX = base.x * mult
        let targetY = base.y * hM
        let targetRot = base.rot
        let targetScale = base.scale
        let delay = 0

        if (hoveredSlot !== null) {
          const distance = Math.abs(slot - hoveredSlot)
          delay = distance * 0.02

          if (slot === hoveredSlot) {
            targetY -= 2.5 * hM
            targetScale *= 1.08
          } else {
            const normalized = centerSlot > 0 ? (slot - centerSlot) / centerSlot : 0
            const pushStrength = 8 * (1 - Math.abs(normalized)) * (1 + 0.2 * Math.max(0, 3 - distance))

            if (slot < hoveredSlot) {
              targetX -= pushStrength * mult
              targetRot -= 3 / (distance + 1)
            } else {
              targetX += pushStrength * mult
              targetRot += 3 / (distance + 1)
            }

            if (slot === visibleEntries.length - 1 && hoveredSlot < centerSlot) targetY -= 1 * hM
            if (slot === 0 && hoveredSlot > centerSlot) targetY -= 1 * hM
          }
        } else {
          delay = Math.abs(slot - centerSlot) * 0.02
        }

        gsap.to(el, {
          x: `${targetX}rem`,
          y: `${targetY}rem`,
          rotation: targetRot,
          scale: targetScale,
          duration: 0.5,
          delay,
          ease: "elastic.out(1,.75)",
          overwrite: "auto",
        })
        gsap.set(el, { zIndex: hoveredSlot === slot ? 20 : base.zIndex })
      })
    }

    const enterHandlers = visibleEntries.map(({ el, slot }) => {
      const handler = () => {
        if (isAnimating.current) return
        if (leaveTimer) {
          clearTimeout(leaveTimer)
          leaveTimer = null
        }
        if (activeSlot !== slot) {
          activeSlot = slot
          updateHoverLayout(slot)
        }
      }
      el.addEventListener("mouseenter", handler)
      el.addEventListener("focus", handler)
      return { el, handler }
    })

    const onMouseLeave = () => {
      if (isAnimating.current) return
      if (leaveTimer) clearTimeout(leaveTimer)
      leaveTimer = setTimeout(() => {
        activeSlot = null
        updateHoverLayout(null)
      }, 50)
    }
    container.addEventListener("mouseleave", onMouseLeave)
    container.addEventListener("focusout", onMouseLeave)

    const onResize = () => {
      if (!isAnimating.current) updateHoverLayout(activeSlot)
    }
    window.addEventListener("resize", onResize)

    return () => {
      enterHandlers.forEach(({ el, handler }) => {
        el.removeEventListener("mouseenter", handler)
        el.removeEventListener("focus", handler)
      })
      container.removeEventListener("mouseleave", onMouseLeave)
      container.removeEventListener("focusout", onMouseLeave)
      window.removeEventListener("resize", onResize)
      if (leaveTimer) clearTimeout(leaveTimer)
    }
  }, [centerIndex, totalCards, getVisibleMap, needsPagination, inView])

  // Kill any running tweens when the component unmounts.
  React.useEffect(() => {
    const container = containerRef.current
    return () => {
      if (container) gsap.killTweensOf(container.querySelectorAll(".fan-card"))
    }
  }, [])

  if (!totalCards) return null

  return (
    <div className={cn("relative z-20 flex w-full flex-col items-center", className)}>
      <div
        ref={containerRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") cycle("right")
          if (e.key === "ArrowLeft") cycle("left")
        }}
        className="fan-layout relative flex w-full max-w-[80rem] items-center justify-center"
      >
        {cards.map((card, index) => {
          const active = index === centerIndex
          const origin = card.focus ? `${card.focus.x}% ${card.focus.y}%` : "50% 50%"
          const inner = (
            <span className="relative block size-full overflow-hidden">
              <Image
                src={card.imgUrl}
                alt={card.alt ?? card.title ?? ""}
                fill
                sizes={card.sizes ?? "(min-width: 1024px) 40vw, 80vw"}
                className="object-cover transition-[filter] duration-500 group-hover:brightness-110"
                style={{ objectPosition: origin, transformOrigin: origin, scale: String(card.zoom ?? 1) }}
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/25" />
              <span className="king-label absolute top-3 left-3 text-[0.55rem] text-king-muted md:text-[0.6rem]">
                {String(index + 1).padStart(2, "0")}
              </span>
              {(card.title || card.meta) && (
                <span className="absolute inset-x-4 bottom-4 hidden text-left md:block">
                  {card.title && (
                    <span className="block text-sm leading-tight font-semibold tracking-tight text-king-white uppercase">
                      {card.title}
                    </span>
                  )}
                  {card.meta && (
                    <span className="king-label mt-1 block text-[0.6rem] text-king-gray">{card.meta}</span>
                  )}
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 bottom-0 h-[2px] origin-left bg-king-bright-red transition-transform duration-500 ease-king",
                  active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                )}
              />
            </span>
          )

          const cardClass = cn(
            "fan-card group block cursor-pointer border bg-king-card text-left shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] outline-none focus-visible:ring-2 focus-visible:ring-king-bright-red",
            active ? "border-king-red-line" : "border-white/10"
          )

          if (card.onSelect) {
            return (
              <button key={index} type="button" onClick={card.onSelect} className={cardClass} aria-label={card.title}>
                {inner}
              </button>
            )
          }
          if (card.linkUrl) {
            const external = card.linkUrl.startsWith("http")
            return external ? (
              <a key={index} href={card.linkUrl} target="_blank" rel="noopener noreferrer" className={cardClass}>
                {inner}
              </a>
            ) : (
              <Link key={index} href={card.linkUrl} className={cardClass}>
                {inner}
              </Link>
            )
          }
          return (
            <div key={index} className={cardClass}>
              {inner}
            </div>
          )
        })}
      </div>

      {needsPagination && (
        <div className="z-30 mt-6 flex items-center justify-center gap-5 md:mt-8">
          <button type="button" className={ARROW_CLASSES} onClick={() => cycle("left")} aria-label="Previous">
            <ChevronLeft className="size-4 md:size-5" aria-hidden />
          </button>
          <div className="flex items-center gap-2" aria-hidden>
            {cards.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-[2px] transition-all duration-500 ease-king",
                  i === centerIndex ? "w-6 bg-king-bright-red" : "w-2 bg-white/20"
                )}
              />
            ))}
          </div>
          <button type="button" className={ARROW_CLASSES} onClick={() => cycle("right")} aria-label="Next">
            <ChevronRight className="size-4 md:size-5" aria-hidden />
          </button>
          <span className="sr-only" aria-live="polite">
            {`${centerIndex + 1} of ${totalCards}`}
          </span>
        </div>
      )}
    </div>
  )
}

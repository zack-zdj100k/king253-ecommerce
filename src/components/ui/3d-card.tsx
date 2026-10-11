"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  TiltCard — the 3D tilt behaviour on its own, for wrapping any card.        */
/* -------------------------------------------------------------------------- */

type TiltCardProps = React.ComponentProps<"div"> & {
  /** Maximum tilt in degrees. */
  max?: number
  /** Classes for the tilting element (the outer div only provides perspective). */
  innerClassName?: string
}

/**
 * Wrap a decorative card to give it a spring-smoothed 3D tilt that follows the
 * mouse. Children can float above the surface with <TiltLayer depth={…}>.
 * Mouse only (no movement on phones/tablets), and off for reduced motion.
 */
export function TiltCard({ max = 10.5, className, innerClassName, children, style, ...props }: TiltCardProps) {
  const reduceMotion = useReducedMotion()
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springConfig = { damping: 15, stiffness: 150 }
  const springX = useSpring(mouseX, springConfig)
  const springY = useSpring(mouseY, springConfig)

  const rotateX = useTransform(springY, [-0.5, 0.5], [`${max}deg`, `-${max}deg`])
  const rotateY = useTransform(springX, [-0.5, 0.5], [`-${max}deg`, `${max}deg`])

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || e.pointerType !== "mouse") return
    const { width, height, left, top } = e.currentTarget.getBoundingClientRect()
    mouseX.set((e.clientX - left) / width - 0.5)
    mouseY.set((e.clientY - top) / height - 0.5)
  }

  const reset = () => {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <div className={cn("[perspective:1000px]", className)} style={style} {...props}>
      <motion.div
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn("relative h-full w-full", innerClassName)}
      >
        {children}
      </motion.div>
    </div>
  )
}

/** A layer lifted `depth` px towards the viewer inside a TiltCard. */
export function TiltLayer({
  depth = 40,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { depth?: number }) {
  return (
    <div
      className={className}
      style={{ transform: `translateZ(${depth}px)`, transformStyle: "preserve-3d", ...style }}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  InteractiveCard — the full card design (image, header, arrow, action).     */
/* -------------------------------------------------------------------------- */

export interface InteractiveCardProps {
  /** Headline over the image, e.g. a product or category name. */
  title?: string
  /** Secondary line, e.g. category or colour. */
  subtitle?: string
  imageUrl: string
  imageAlt?: string
  /** Focal point (percent) + zoom to crop the image. */
  focus?: { x: number; y: number }
  zoom?: number
  sizes?: string
  /** Bottom action button. */
  actionText?: string
  onActionClick?: () => void
  /** Renders the action as disabled (e.g. out of stock). */
  actionDisabled?: boolean
  /** Top-right arrow: internal/external link… */
  href?: string
  /** …or a callback (e.g. open quick view). */
  onArrowClick?: () => void
  arrowLabel?: string
  /** Extra controls placed top-left (e.g. index, wishlist). */
  topSlot?: React.ReactNode
  /** Red promotion bar shown across the card, above the action button. */
  promo?: string | null
  /** One click anywhere on the card opens `href` (the action becomes a label). */
  linkWholeCard?: boolean
  /** Cut the top-left and bottom-right corners (KING 253 chamfer). */
  chamfer?: boolean
  className?: string
}

const GLASS =
  "bg-black/65 ring-1 ring-inset ring-white/15 transition-colors duration-300 hover:bg-king-red hover:ring-king-bright-red"

export const InteractiveCard = React.forwardRef<HTMLDivElement, InteractiveCardProps>(function InteractiveCard(
  {
    title,
    subtitle,
    imageUrl,
    imageAlt,
    focus,
    zoom = 1,
    sizes = "(min-width: 1024px) 25vw, 50vw",
    actionText,
    onActionClick,
    actionDisabled = false,
    href,
    onArrowClick,
    arrowLabel,
    topSlot,
    promo,
    linkWholeCard = false,
    chamfer = true,
    className,
  },
  ref
) {
  const origin = focus ? `${focus.x}% ${focus.y}%` : "50% 50%"
  const clip = chamfer ? "king-chamfer" : "rounded-md"
  const label = arrowLabel ?? (title ? `View ${title}` : "View")

  const arrowInner = <ArrowUpRight className="size-4 text-king-white md:size-5" aria-hidden />
  const arrowClass = cn("pointer-events-auto grid size-9 place-items-center rounded-full md:size-10", GLASS)

  return (
    <div ref={ref} className={cn("group/card relative", className)}>
      {/* Static card (no tilt): it must be easy to tap and open. */}
      <div className="relative h-full w-full">
        {linkWholeCard && href && <Link href={href} aria-label={label} className="absolute inset-0 z-10" />}
        {/* Frame */}
        <div
          className={cn(
            "absolute inset-0 bg-king-surface-light shadow-[0_30px_60px_-30px_rgba(0,0,0,0.95)]",
            clip
          )}
        >
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_50%_100%,rgba(163,13,13,0.45),transparent_70%)]" />
        </div>

        {/* Image, lifted off the frame */}
        <div className={cn("absolute inset-2 overflow-hidden md:inset-3", clip)}>
          <Image
            src={imageUrl}
            alt={imageAlt ?? [title, subtitle].filter(Boolean).join(", ")}
            fill
            sizes={sizes}
            className="object-cover transition-[filter] duration-500 group-hover/card:brightness-110"
            style={{ objectPosition: origin, transformOrigin: origin, scale: String(zoom) }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/70" />
        </div>

        {/* Content, floating highest */}
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col justify-between p-3 text-king-white md:inset-3 md:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto min-w-0">
              {topSlot}
              {title && (
                <p className="truncate text-sm font-semibold tracking-tight uppercase md:text-base">
                  {title}
                </p>
              )}
              {subtitle && <p className="king-label mt-1 text-[0.55rem] text-white/75 md:text-[0.6rem]">{subtitle}</p>}
            </div>
            {href ? (
              href.startsWith("http") ? (
                <motion.a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, rotate: 2.5 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label={label}
                  className={arrowClass}
                >
                  {arrowInner}
                </motion.a>
              ) : (
                <motion.div whileHover={{ scale: 1.1, rotate: 2.5 }} whileTap={{ scale: 0.9 }}>
                  <Link href={href} aria-label={label} className={arrowClass}>
                    {arrowInner}
                  </Link>
                </motion.div>
              )
            ) : onArrowClick ? (
              <motion.button
                type="button"
                onClick={onArrowClick}
                whileHover={{ scale: 1.1, rotate: 2.5 }}
                whileTap={{ scale: 0.9 }}
                aria-label={label}
                className={arrowClass}
              >
                {arrowInner}
              </motion.button>
            ) : null}
          </div>

          <div className="space-y-2">
          {promo && (
            <p className="king-label flex items-center justify-center gap-2 bg-king-red py-1.5 text-center text-[0.55rem] text-king-white shadow-[0_8px_24px_-8px_rgba(212,20,20,0.7)] md:text-[0.6rem]">
              <span className="size-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />
              {promo}
            </p>
          )}
          {actionText && onActionClick && (
            <motion.button
              type="button"
              onClick={onActionClick}
              disabled={actionDisabled}
              whileHover={actionDisabled ? undefined : { scale: 1.04 }}
              whileTap={actionDisabled ? undefined : { scale: 0.96 }}
              className={cn(
                "king-label pointer-events-auto w-full py-2.5 text-center text-[0.6rem] text-king-white md:py-3 md:text-[0.65rem]",
                GLASS,
                actionDisabled && "cursor-not-allowed text-king-gray hover:bg-black/45 hover:ring-white/15"
              )}
            >
              {actionText}
            </motion.button>
          )}
          {actionText && !onActionClick && (
            // Label only: the click goes to the whole-card link underneath.
            <span className={cn("king-label block w-full py-2.5 text-center text-[0.6rem] text-king-white md:py-3 md:text-[0.65rem]", GLASS, "group-hover/card:bg-king-red group-hover/card:ring-king-bright-red", actionDisabled && "text-king-gray")}>
              {actionText}
            </span>
          )}
          </div>
        </div>
      </div>
    </div>
  )
})

/** Name kept from the original component for compatibility. */
export const InteractiveTravelCard = InteractiveCard

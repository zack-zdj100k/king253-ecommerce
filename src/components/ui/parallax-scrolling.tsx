"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { gsap, MOTION_OK } from "@/lib/gsap"

/**
 * Multi-layer scroll parallax.
 *
 * Wrap layers in <ParallaxScrolling> (renders `data-parallax-layers`) and mark
 * each child with `data-parallax-layer="1" | "2" | "3" | "4"`. Layer 1 is the
 * deepest and travels the furthest down as the section scrolls out, so it
 * appears to move slowest. Override per layer with `data-parallax-movement`.
 *
 * Smooth scrolling comes from the global Lenis instance (see SmoothScroll),
 * which feeds ScrollTrigger on every frame.
 */
const LAYER_MOVEMENT: Record<string, number> = {
  "1": 70,
  "2": 55,
  "3": 35,
  "4": 10,
}

type ParallaxScrollingProps = React.ComponentProps<"div"> & {
  /** Scales every layer's travel. 1 = the values above. */
  intensity?: number
  /** Scales travel on viewports below 768px. */
  mobileIntensity?: number
}

export function ParallaxScrolling({
  className,
  intensity = 1,
  mobileIntensity = 0.45,
  children,
  ...props
}: ParallaxScrollingProps) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const root = ref.current
    if (!root) return

    const mm = gsap.matchMedia(root)
    mm.add(
      {
        desktop: `(min-width: 768px) and ${MOTION_OK}`,
        mobile: `(max-width: 767px) and ${MOTION_OK}`,
      },
      (context) => {
        const scale = (context.conditions?.desktop ? intensity : mobileIntensity) ?? 1
        const tl = gsap.timeline({
          scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 0 },
        })
        root.querySelectorAll<HTMLElement>("[data-parallax-layer]").forEach((layer) => {
          const base =
            Number(layer.dataset.parallaxMovement) || LAYER_MOVEMENT[layer.dataset.parallaxLayer ?? ""] || 0
          tl.to(layer, { yPercent: base * scale, ease: "none" }, 0)
        })
      }
    )

    return () => mm.revert()
  }, [intensity, mobileIntensity])

  return (
    <div ref={ref} data-parallax-layers="" className={cn("relative overflow-hidden", className)} {...props}>
      {children}
    </div>
  )
}

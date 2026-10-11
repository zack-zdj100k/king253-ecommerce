"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { gsap, ScrollTrigger, MOTION_OK } from "@/lib/gsap"

/**
 * Page-wide scroll choreography, declared with data attributes so server
 * components stay server components:
 *
 *   data-reveal          fade-rise when entering the viewport (batched)
 *   data-reveal-image    curtain reveal (clip-path) + settle from scale 1.12
 *   data-speed="8"       subtle vertical parallax in yPercent (desktop only)
 */
export function ScrollAnimations() {
  const pathname = usePathname()

  React.useEffect(() => {
    const mm = gsap.matchMedia()

    mm.add(MOTION_OK, () => {
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]")
      gsap.set(reveals, { autoAlpha: 0, y: 36 })
      const show = (batch: Element[]) =>
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, ease: "power3.out", stagger: 0.1, overwrite: true })
      ScrollTrigger.batch(reveals, { start: "top 90%", onEnter: show, onLeave: show })

      gsap.utils.toArray<HTMLElement>("[data-reveal-image]").forEach((el) => {
        const img = el.querySelector("img")
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } })
        tl.fromTo(el, { clipPath: "inset(18% 0% 18% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "power3.inOut" })
        if (img) tl.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 1.8, ease: "power2.out" }, 0)
      })
    })

    mm.add(`(min-width: 768px) and ${MOTION_OK}`, () => {
      gsap.utils.toArray<HTMLElement>("[data-speed]").forEach((el) => {
        const speed = Number(el.dataset.speed) || 8
        gsap.fromTo(
          el,
          { yPercent: -speed },
          {
            yPercent: speed,
            ease: "none",
            scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true },
          }
        )
      })
    })

    return () => mm.revert()
  }, [pathname])

  return null
}

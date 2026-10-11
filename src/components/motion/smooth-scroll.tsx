"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Lenis from "lenis"

import { gsap, ScrollTrigger } from "@/lib/gsap"

/**
 * Scrolling: native for the wheel and touch (no smoothing lag); Lenis runs on
 * the GSAP ticker so ScrollTrigger and programmatic scrolls share one frame loop.
 */
export function SmoothScroll() {
  const lenisRef = React.useRef<Lenis | null>(null)
  const pathname = usePathname()

  React.useEffect(() => {
    // Native wheel/touch scrolling — instant and as fast as the device allows.
    // Lenis only drives programmatic jumps (e.g. #section links) and feeds ScrollTrigger.
    const lenis = new Lenis({
      smoothWheel: false,
      autoRaf: false,
      stopInertiaOnNavigate: true,
      prevent: (node) => node.closest?.("[data-lenis-prevent], [role='dialog']") != null,
    })
    lenisRef.current = lenis

    lenis.on("scroll", ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    // Pause smoothing while a Radix overlay (sheet, dialog) locks the page.
    const observer = new MutationObserver(() => {
      if (document.body.hasAttribute("data-scroll-locked")) lenis.stop()
      else lenis.start()
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] })

    return () => {
      observer.disconnect()
      gsap.ticker.remove(tick)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  // New route: re-measure page height and triggers, then honour a #section link
  // (e.g. "View page" from the admin content editor) once the layout has settled.
  React.useEffect(() => {
    lenisRef.current?.resize()
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    const hash = window.location.hash.slice(1)
    const jump = hash
      ? window.setTimeout(() => {
          const target = document.getElementById(decodeURIComponent(hash))
          if (!target) return
          if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -72, immediate: true, force: true })
          else target.scrollIntoView()
        }, 350)
      : undefined
    return () => {
      cancelAnimationFrame(id)
      if (jump) window.clearTimeout(jump)
    }
  }, [pathname])

  return null
}

"use client"

import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

export const MOTION_OK = "(prefers-reduced-motion: no-preference)"

/**
 * Poor connection or data saver: skip entrance animations so the page is usable as soon as
 * its HTML arrives (the text is already in the HTML — hiding it to fade it back in only delays it).
 * Also true when the scripts arrived late (> 2.5 s after the page started), for the same reason.
 */
export function lightMode() {
  if (typeof window === "undefined") return false
  const root = document.documentElement
  const w = window as Window & { __kingMotion?: boolean }
  // Decided once per page view: the first animated component to start claims motion, or gives up.
  if (w.__kingMotion) return false
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const slow = !root.classList.contains("js") || !!c?.saveData || /(^|-)2g$|^3g$/.test(c?.effectiveType ?? "") || performance.now() > 2500
  if (slow) {
    // Show everything that was waiting to be animated in.
    root.classList.remove("js")
    return true
  }
  w.__kingMotion = true
  return false
}

export { gsap, ScrollTrigger }

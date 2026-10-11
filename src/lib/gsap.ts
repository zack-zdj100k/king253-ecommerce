"use client"

import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

export const MOTION_OK = "(prefers-reduced-motion: no-preference)"

export { gsap, ScrollTrigger }

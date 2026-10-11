"use client"

import * as React from "react"
import { Rubik_Wet_Paint } from "next/font/google"
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion"
import { Crown } from "lucide-react"

import { cn } from "@/lib/utils"
import { gsap, MOTION_OK } from "@/lib/gsap"

// Dripping spray-paint letters — echoes the KING 253 graffiti on the studio wall.
const graffiti = Rubik_Wet_Paint({ weight: "400", subsets: ["latin"], display: "swap" })

const DEPTH = 16
const FACE = [0x8f, 0x0b, 0x0b] // extrusion colour nearest the face
const BACK = [0x14, 0x02, 0x02] // furthest back

/** Stacked text-shadows = solid extruded block letters. Direction follows the tilt. */
function extrusion(dirX: number, dirY: number) {
  const layers: string[] = []
  for (let i = 1; i <= DEPTH; i++) {
    const t = i / DEPTH
    const c = FACE.map((f, k) => Math.round(f + (BACK[k] - f) * t))
    layers.push(`${(dirX * i * 0.011).toFixed(4)}em ${(dirY * i * 0.011).toFixed(4)}em 0 rgb(${c.join(",")})`)
  }
  // Contact shadow on the wall + red spray glow.
  layers.push(`${(dirX * 0.2).toFixed(3)}em ${(dirY * 0.24).toFixed(3)}em 0.18em rgba(0,0,0,0.85)`)
  layers.push("0 0 0.45em rgba(255,26,26,0.28)")
  return layers.join(", ")
}

export function GraffitiWordmark({ text = "King 253", className }: { text?: string; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  // Pointer → spring → tilt + extrusion direction.
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { damping: 18, stiffness: 120 })
  const sy = useSpring(my, { damping: 18, stiffness: 120 })
  const rotateX = useTransform(sy, [-0.5, 0.5], ["7deg", "-7deg"])
  const rotateY = useTransform(sx, [-0.5, 0.5], ["-9deg", "9deg"])
  // The block extrudes away from the pointer, like a real sign seen from that angle.
  const textShadow = useTransform([sx, sy], ([x, y]: number[]) => extrusion(0.55 - x * 1.6, 0.75 - y * 1.2))

  // Spray-paint reveal: wipe in left → right with the mist settling.
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, clipPath: "inset(-20% 100% -20% 0%)", filter: "blur(10px)" },
        {
          autoAlpha: 1,
          clipPath: "inset(-20% 0% -20% 0%)",
          filter: "blur(0px)",
          duration: 1.6,
          ease: "power2.inOut",
          clearProps: "clipPath,filter",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        }
      )
    })
    return () => mm.revert()
  }, [])

  return (
    <div
      ref={ref}
      data-spray
      className={cn("relative flex justify-center [perspective:1200px]", className)}
      onPointerMove={(e) => {
        if (reduceMotion || e.pointerType !== "mouse") return
        const r = e.currentTarget.getBoundingClientRect()
        mx.set((e.clientX - r.left) / r.width - 0.5)
        my.set((e.clientY - r.top) / r.height - 0.5)
      }}
      onPointerLeave={() => {
        mx.set(0)
        my.set(0)
      }}
    >
      {/* Spray haze on the wall behind the piece */}
      <div aria-hidden className="pointer-events-none absolute inset-x-[8%] inset-y-[10%] king-glow [--glow:rgb(163_13_13_/_0.25)]" />

      <motion.p
        aria-label={text}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn(
          graffiti.className,
          "relative py-[0.12em] text-[clamp(4rem,15.5vw,17rem)] leading-none whitespace-nowrap uppercase select-none"
        )}
      >
        {/* Extruded body */}
        <motion.span aria-hidden className="block text-king-deep-red" style={{ textShadow }}>
          {text}
        </motion.span>

        {/* Painted face: white fading into red, black outline */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-[0.12em] block bg-[linear-gradient(180deg,#ffffff_0%,#efe6e6_42%,#ff3b3b_74%,#a30d0d_100%)] bg-clip-text text-transparent [-webkit-text-stroke:0.018em_#050505]"
        >
          {text}
        </span>

        {/* Crown tag over the K, like the wall piece */}
        <Crown
          aria-hidden
          strokeWidth={2.2}
          className="absolute top-[-0.08em] left-[0.02em] size-[0.42em] -rotate-12 text-king-bright-red drop-shadow-[0_0_0.08em_rgba(255,26,26,0.7)]"
        />
      </motion.p>
    </div>
  )
}

"use client"

import * as React from "react"

import { gsap, MOTION_OK } from "@/lib/gsap"
import { TiltCard, TiltLayer } from "@/components/ui/3d-card"

/** Tilt each card falls from, and the slight angle it lands at. */
const DROP_TILT = [-16, 12, -9]
const REST_TILT = [-1.5, 1.2, -0.8]

export function MindsetPillars({ pillars }: { pillars: string[] }) {
  const ref = React.useRef<HTMLOListElement>(null)

  React.useEffect(() => {
    const list = ref.current
    if (!list) return
    const mm = gsap.matchMedia(list)

    mm.add(MOTION_OK, () => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-fall]")
      gsap.set(cards, { autoAlpha: 0, yPercent: -170, rotation: (i: number) => DROP_TILT[i] ?? 0 })

      const tl = gsap.timeline({ scrollTrigger: { trigger: list, start: "top 85%", once: true } })
      cards.forEach((card, i) => {
        const at = i * 0.22
        tl.to(card, { autoAlpha: 1, duration: 0.25, ease: "none" }, at)
          // Drop: accelerate like it has weight.
          .to(card, { yPercent: 0, duration: 0.62, ease: "power3.in" }, at)
          // Impact: a short rebound, then settle.
          .to(card, { yPercent: -7, duration: 0.18, ease: "power2.out" }, at + 0.62)
          .to(card, { yPercent: 0, duration: 0.22, ease: "bounce.out" }, at + 0.8)
          // Rotation wobbles into its resting angle.
          .to(card, { rotation: REST_TILT[i] ?? 0, duration: 1.1, ease: "elastic.out(1, 0.45)" }, at + 0.5)
      })
    })

    return () => mm.revert()
  }, [])

  return (
    <ol ref={ref} className="grid gap-4 sm:grid-cols-3 sm:gap-3 lg:gap-5">
      {pillars.map((pillar, i) => (
        <li key={pillar} data-fall className="will-change-transform">
          <TiltCard max={9}>
            <div className="group relative flex min-h-[12rem] flex-col justify-between border border-white/10 [transform-style:preserve-3d] bg-king-near-black p-6 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.9)] transition-[translate,border-color,box-shadow,rotate] duration-500 ease-king hover:-translate-y-2 hover:rotate-0 hover:border-king-red-line hover:shadow-[0_34px_70px_-30px_rgba(255,26,26,0.5)] md:min-h-[15rem] md:p-7">
              {/* Red studio glow on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[12%] rounded-full bg-king-red/0 blur-2xl transition-colors duration-700 group-hover:bg-king-red/20"
              />

              <TiltLayer depth={30} className="relative flex items-start justify-between">
                <span className="king-display text-[4.25rem] leading-none text-transparent transition-[-webkit-text-stroke-color] duration-500 [-webkit-text-stroke:1px_rgba(255,255,255,0.28)] group-hover:[-webkit-text-stroke-color:var(--color-king-bright-red)] md:text-[5.25rem]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-2 size-2 bg-king-bright-red shadow-[0_0_14px_2px_rgba(255,26,26,0.6)]" aria-hidden />
              </TiltLayer>

              <p style={{ transform: "translateZ(40px)" }} className="relative mt-8 text-base leading-snug font-semibold tracking-tight text-king-white uppercase md:text-lg">
                {pillar}
              </p>

              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-king-bright-red transition-transform duration-700 ease-king group-hover:scale-x-100"
              />
            </div>
          </TiltCard>
        </li>
      ))}
    </ol>
  )
}

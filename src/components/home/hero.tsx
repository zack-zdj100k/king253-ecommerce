"use client"

import * as React from "react"
import Image from "next/image"

import MotionButton from "@/components/ui/motion-button"
import { ParallaxScrolling } from "@/components/ui/parallax-scrolling"
import { HeroSlideshow } from "@/components/home/hero-slideshow"
import { gsap, MOTION_OK } from "@/lib/gsap"

export type HeroContent = {
  eyebrow: string
  headline: string
  secondary: string
  description: string
  primaryCta: string
  secondaryCta: string
  slide1: string
  slide2: string
  slide3: string
  slide4: string
  background: string
}

export function Hero({ content }: { content: HeroContent }) {
  const headline = content.headline.split("\n").map((l) => l.trim()).filter(Boolean)
  const ref = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    const mm = gsap.matchMedia(ref.current ?? undefined)
    mm.add(MOTION_OK, () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.15 })
      tl.fromTo(
        "[data-hero-media]",
        { scale: 1.05 },
        { scale: 1, duration: 2.8, ease: "power2.out", clearProps: "transform,scale" },
        0
      )
        .fromTo("[data-hero-eyebrow]", { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0.35)
        .fromTo(
          "[data-hero-line]",
          { autoAlpha: 0, yPercent: 105 },
          { autoAlpha: 1, yPercent: 0, duration: 1.35, ease: "power4.out", stagger: 0.12 },
          0.45
        )
        .fromTo("[data-hero-secondary]", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.1 }, 1.0)
        .fromTo("[data-hero-desc]", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.1 }, 1.15)
        .fromTo("[data-hero-cta]", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.1 }, 1.3)
        .fromTo("[data-hero-meta]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, 1.6)
    })
    return () => mm.revert()
  }, [])

  return (
    <section
      id="hero"
      ref={ref}
      aria-labelledby="hero-title"
      className="relative h-svh min-h-[720px] bg-king-black"
    >
      <ParallaxScrolling className="absolute inset-0">
        {/* Layer 1 — brick wall */}
        <div data-parallax-layer="1" className="absolute inset-0">
          <Image
            src={content.background}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-45 blur-[1px] saturate-[1.1]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,transparent_0%,rgba(5,5,5,0.55)_55%,#050505_100%)]" />
        </div>

        {/* Layer 2 — red atmospheric light */}
        <div data-parallax-layer="2" className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute top-[-20%] left-[-10%] h-[80%] w-[70%] king-glow [--glow:rgb(92_7_7_/_0.60)]" />
          <div className="absolute top-[5%] right-[10%] h-[45%] w-[40%] king-glow [--glow:rgb(163_13_13_/_0.25)]" />
        </div>

        {/* Layer 3 — the model (campaign slideshow) */}
        <div data-parallax-layer="3" className="absolute inset-0">
          <HeroSlideshow slides={[content.slide1, content.slide2, content.slide3, content.slide4]} mediaClassName="lg:left-[24%] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_32%)]" />
          {/* Readability: bottom fade on mobile, left fade on desktop, vignette everywhere */}
          <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_top,#050505_8%,rgba(5,5,5,0.86)_38%,rgba(5,5,5,0.15)_70%,rgba(5,5,5,0.35)_100%)] lg:bg-[linear-gradient(to_right,rgba(5,5,5,0.75)_0%,rgba(5,5,5,0.35)_35%,transparent_55%),linear-gradient(to_top,rgba(5,5,5,0.85)_0%,transparent_30%)]" />
          <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_180px_40px_rgba(0,0,0,0.75)]" />
        </div>

        {/* Layer 4 — typography and UI */}
        <div data-parallax-layer="4" className="pointer-events-none relative z-10 h-full">
          <div className="mx-auto flex h-full max-w-[1600px] flex-col justify-end px-4 pt-28 pb-28 sm:px-6 lg:justify-center lg:px-12 lg:pb-16">
            <div className="pointer-events-auto max-w-[min(100%,44rem)]">
              <p data-hero-reveal data-hero-eyebrow className="king-label flex items-center gap-3 text-king-muted">
                <span className="h-px w-8 bg-king-bright-red" aria-hidden />
                {content.eyebrow}
              </p>

              <h1
                id="hero-title"
                className="king-display mt-5 text-[clamp(3.6rem,min(10vw,15svh),10rem)] text-king-white"
              >
                {headline.map((line) => (
                  <span key={line} className="block overflow-hidden pb-[0.04em]">
                    <span data-hero-reveal data-hero-line className="block">
                      {line}
                    </span>
                  </span>
                ))}
              </h1>

              <p
                data-hero-reveal
                data-hero-secondary
                className="king-serif mt-4 text-[clamp(1.9rem,3.4vw,3.25rem)] leading-none text-king-white"
              >
                {content.secondary.replace(/\.$/, "")}<span className="text-king-bright-red">.</span>
              </p>

              <p data-hero-reveal data-hero-desc className="mt-5 max-w-sm text-sm leading-relaxed text-king-muted md:text-base">
                {content.description}
              </p>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
                <div data-hero-reveal data-hero-cta>
                  <MotionButton href="/clothes" label={content.primaryCta} />
                </div>
                <div data-hero-reveal data-hero-cta>
                  <MotionButton href="/who-is-king" label={content.secondaryCta} variant="secondary" />
                </div>
              </div>
            </div>
          </div>

          {/* Scroll cue — desktop only */}
          <div
            data-hero-reveal
            data-hero-meta
            className="absolute bottom-10 left-12 hidden items-center gap-4 lg:flex"
            aria-hidden
          >
            <span className="relative block h-12 w-px overflow-hidden bg-white/15">
              <span className="absolute inset-x-0 top-0 h-1/2 animate-[king-scroll_2.4s_ease-in-out_infinite] bg-king-bright-red motion-reduce:animate-none" />
            </span>
            <span className="king-label text-[0.625rem] text-king-gray">Scroll</span>
          </div>
        </div>
      </ParallaxScrolling>
    </section>
  )
}

"use client"

import * as React from "react"
import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

export type Testimonial = { id: string; quote: string; name: string; role?: string | null; imageUrl?: string | null }

/**
 * One endlessly scrolling column (the list is rendered twice and moved -50%).
 * Content always comes from admin-published testimonials.
 */
export const TestimonialsColumn = (props: { className?: string; testimonials: Testimonial[]; duration?: number }) => {
  const reduceMotion = useReducedMotion()
  return (
    <div className={props.className}>
      <motion.div
        animate={reduceMotion ? undefined : { translateY: "-50%" }}
        transition={{ duration: props.duration || 10, repeat: Infinity, ease: "linear", repeatType: "loop" }}
        className="flex flex-col gap-6 pb-6"
      >
        {[0, 1].map((copy) => (
          <React.Fragment key={copy}>
            {props.testimonials.map((t) => (
              <figure
                key={`${copy}-${t.id}`}
                aria-hidden={copy === 1}
                className="king-chamfer relative w-full max-w-xs border border-white/10 bg-king-near-black p-8 shadow-[0_20px_50px_-30px_rgba(163,13,13,0.6)] [--cut:16px]"
              >
                <span aria-hidden className="king-serif absolute top-3 right-5 text-6xl leading-none text-king-red/50">
                  &rdquo;
                </span>
                <blockquote className="relative text-sm leading-relaxed text-king-muted">{t.quote}</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  {t.imageUrl ? (
                    <Image src={t.imageUrl} alt="" width={40} height={40} className="size-10 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden className="grid size-10 place-items-center rounded-full bg-king-red/20 text-sm font-semibold text-king-white ring-1 ring-king-red-line">
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="flex flex-col">
                    <span className="text-sm leading-5 font-semibold tracking-tight text-king-white uppercase">{t.name}</span>
                    {t.role && <span className="king-label mt-0.5 text-[0.55rem] text-king-gray">{t.role}</span>}
                  </span>
                </figcaption>
              </figure>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  )
}

/** Three staggered columns (one on mobile, two on tablet) fading at top and bottom. */
export function TestimonialsColumns({ testimonials, className }: { testimonials: Testimonial[]; className?: string }) {
  const third = Math.ceil(testimonials.length / 3)
  const first = testimonials.slice(0, third)
  const second = testimonials.slice(third, third * 2)
  const thirdCol = testimonials.slice(third * 2)
  return (
    <div
      className={cn(
        "flex max-h-[740px] justify-center gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]",
        className
      )}
    >
      <TestimonialsColumn testimonials={first.length ? first : testimonials} duration={15} />
      {second.length > 0 && <TestimonialsColumn testimonials={second} className="hidden md:block" duration={19} />}
      {thirdCol.length > 0 && <TestimonialsColumn testimonials={thirdCol} className="hidden lg:block" duration={17} />}
    </div>
  )
}

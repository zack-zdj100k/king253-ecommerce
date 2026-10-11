import Image from "next/image"

import { cn } from "@/lib/utils"

/** Uppercase eyebrow with a short red rule. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("king-label flex items-center gap-3 text-king-muted", className)}>
      <span className="h-px w-8 bg-king-bright-red" aria-hidden />
      {children}
    </p>
  )
}

/** Text whose final ".", "?" or "!" is shown in brand red (as in the approved design). */
export function RedEnd({ text }: { text: string }) {
  const m = text.match(/^([\s\S]*?)([.?!])$/)
  if (!m) return <>{text}</>
  return (
    <>
      {m[1]}
      <span className="text-king-bright-red">{m[2]}</span>
    </>
  )
}

/** Marks content that is waiting on real KING 253 information. */
export function Placeholder({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border border-dashed border-king-red-line px-2.5 py-1 text-[0.6875rem] font-medium tracking-[0.14em] text-king-muted uppercase",
        className
      )}
    >
      <span className="size-1.5 shrink-0 bg-king-bright-red" aria-hidden />
      {children}
    </span>
  )
}

/** Shared full-bleed hero for inner pages. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
  imageAlt = "",
  imagePosition = "50% 50%",
  imageClassName,
  children,
}: {
  eyebrow: string
  title: React.ReactNode
  subtitle: string
  image: string
  imageAlt?: string
  imagePosition?: string
  imageClassName?: string
  children?: React.ReactNode
}) {
  return (
    <section id="top" className="king-grain relative flex min-h-[78svh] items-end overflow-hidden bg-king-black pt-32 pb-16 md:min-h-[86svh] md:pb-24">
      <div className="absolute inset-0 overflow-hidden">
        <div data-speed="10" className="absolute -inset-y-[12%] inset-x-0">
          <Image
            src={image}
            alt={imageAlt}
            fill
            preload
            quality={90}
            sizes="100vw"
            className={cn("object-cover", imageClassName)}
            style={{ objectPosition: imagePosition }}
          />
        </div>
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_top,#050505_0%,rgba(5,5,5,0.75)_40%,rgba(5,5,5,0.35)_75%,rgba(5,5,5,0.6)_100%)]" />
      <div className="absolute inset-0 shadow-[inset_0_0_200px_60px_rgba(0,0,0,0.8)]" />
      <div aria-hidden className="absolute -bottom-1/3 -left-1/4 h-2/3 w-2/3 king-glow [--glow:rgb(92_7_7_/_0.40)]" />

      <div className="relative mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div data-reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h1 data-reveal className="king-display mt-6 text-[clamp(3.5rem,11vw,11rem)] text-king-white">
          {title}
        </h1>
        <p data-reveal className="king-serif mt-6 max-w-2xl text-[clamp(1.5rem,2.8vw,2.5rem)] leading-tight text-king-muted">
          {subtitle}
        </p>
        {children}
      </div>
    </section>
  )
}

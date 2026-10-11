import Image from "next/image"

import { Eyebrow } from "@/components/layout/editorial"

type AttitudeContent = {
  eyebrow: string
  title: string
  accent: string
  description: string
  image: string
  secondaryImage: string
  captionLeft: string
  captionRight: string
}

export function EditorialSection({ content }: { content: AttitudeContent }) {
  const title = content.title.split("\n").map((l) => l.trim()).filter(Boolean)
  return (
    <section id="attitude" aria-labelledby="attitude-title" className="relative overflow-hidden bg-king-black py-24 md:py-40">
      <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 h-[60%] w-[70%] -translate-x-1/2 king-glow [--glow:rgb(163_13_13_/_0.15)]" />

      <div className="relative mx-auto grid max-w-[1600px] gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-0 lg:px-12">
        {/* Overlapping headline */}
        <div className="relative z-10 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:self-center">
          <div data-reveal>
            <Eyebrow>{content.eyebrow}</Eyebrow>
          </div>
          <h2 id="attitude-title" className="mt-8">
            {title.map((line, i) => (
              <span
                key={`${line}-${i}`}
                data-reveal
                className="king-display block text-[clamp(3rem,8.5vw,9.5rem)] whitespace-nowrap text-king-white lg:[text-shadow:0_10px_60px_rgba(0,0,0,0.6)]"
              >
                {line}
              </span>
            ))}
            <span data-reveal className="king-serif block text-[clamp(3rem,8vw,9rem)] leading-[0.9] text-king-bright-red">
              {content.accent}
            </span>
          </h2>
          <p data-reveal className="mt-8 max-w-sm text-base leading-relaxed text-king-muted md:text-lg">
            {content.description}
          </p>
        </div>

        {/* Main portrait */}
        <figure className="relative lg:col-span-6 lg:col-start-6 lg:row-start-1">
          <div data-reveal-image className="relative aspect-[4/5] overflow-hidden bg-king-card">
            <div data-speed="6" className="absolute -inset-y-[8%] inset-x-0">
              <Image
                src={content.image}
                alt="KING 253 model in a distressed graphic hoodie and black cargo pants leaning on a red barrel, KING 253 graffiti on the brick wall behind"
                fill
                quality={90}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
          <figcaption className="king-label mt-4 flex justify-between text-[0.6rem] text-king-gray">
            <span>{content.captionLeft}</span>
            <span>{content.captionRight}</span>
          </figcaption>
        </figure>

        {/* Secondary frame */}
        <figure className="relative hidden lg:col-span-3 lg:col-start-2 lg:row-start-2 lg:-mt-24 lg:block">
          <div data-reveal-image className="relative aspect-[3/4] overflow-hidden bg-king-card">
            <Image
              src={content.secondaryImage}
              alt="Model in a washed varsity jacket under red spotlights"
              fill
              sizes="60vw"
              className="object-cover object-[67%_50%]"
            />
          </div>
        </figure>
      </div>
    </section>
  )
}

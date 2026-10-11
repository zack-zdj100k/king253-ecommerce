import { Eyebrow } from "@/components/layout/editorial"
import { MindsetPillars } from "@/components/home/mindset-pillars"

export type MindsetContent = { eyebrow: string; headline: string; accent: string; description: string; pillars: string }

export function BrandStatement({ content }: { content: MindsetContent }) {
  return (
    <section id="mindset" aria-labelledby="mindset-title" className="king-grain relative overflow-hidden bg-king-black py-28 md:py-44">
      <div aria-hidden className="pointer-events-none absolute top-1/2 -right-1/4 h-[70%] w-[60%] -translate-y-1/2 king-glow [--glow:rgb(92_7_7_/_0.35)]" />

      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div data-reveal>
          <Eyebrow>{content.eyebrow}</Eyebrow>
        </div>

        <h2 id="mindset-title" className="mt-10 md:mt-14">
          <span data-reveal className="king-display block text-[clamp(3.25rem,11.5vw,12rem)] text-king-white">
            {content.headline}
          </span>
          <span
            data-reveal
            className="king-serif mt-2 block text-right text-[clamp(2.5rem,8vw,8.5rem)] leading-[0.95] text-king-muted md:mt-0"
          >
            {content.accent.replace(/\.$/, "")}<span className="text-king-bright-red">.</span>
          </span>
        </h2>

        <div className="mt-20 grid gap-10 border-t border-white/10 pt-10 md:mt-28 md:grid-cols-[1fr_1.6fr] md:gap-16 lg:gap-20">
          <p data-reveal className="max-w-md text-base leading-relaxed text-king-muted md:text-lg">
            {content.description}
          </p>
          <MindsetPillars pillars={content.pillars.split("\n").map((l) => l.trim()).filter(Boolean)} />
        </div>
      </div>
    </section>
  )
}

import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { db } from "@/server/db"
import { getContent, lines, type ContentOf } from "@/server/content"
import { publishedTestimonials } from "@/server/testimonials"
import { TestimonialsSection } from "@/components/home/testimonials-section"
import { Button } from "@/components/ui/button"
import { PageHero, Placeholder, RedEnd } from "@/components/layout/editorial"
import { TiltCard } from "@/components/ui/3d-card"

export const metadata: Metadata = {
  title: "Who Is King?",
  description: "More than a store. A streetwear identity. Discover the atmosphere and vision behind KING 253.",
}

export const dynamic = "force-dynamic"

export default async function WhoIsKingPage() {
  const [hero, origin, culture, style, experience, testimonialsHeader, testimonials] = await Promise.all([
    getContent(db, "who.hero"),
    getContent(db, "who.origin"),
    getContent(db, "who.culture"),
    getContent(db, "who.style"),
    getContent(db, "who.experience"),
    getContent(db, "home.testimonials"),
    publishedTestimonials(db),
  ])
  return (
    <>
      <PageHero
        eyebrow={hero.eyebrow}
        title={<RedEnd text={hero.title} />}
        subtitle={hero.subtitle}
        image={hero.image}
        imageAlt="KING 253 model in a distressed graphic hoodie beneath the KING 253 graffiti wordmark"
        imagePosition="50% 28%"
      />
      <Origin content={origin} />
      <Culture content={culture} />
      <Style content={style} />
      <TestimonialsSection testimonials={testimonials} content={testimonialsHeader} />
      <Experience content={experience} />
    </>
  )
}

function SectionIndex({ n, title }: { n: string; title: string }) {
  return (
    <div data-reveal className="flex items-center gap-4">
      <span className="king-label text-[0.625rem] text-king-bright-red">{n}</span>
      <span className="h-px w-10 bg-white/20" aria-hidden />
      <p className="king-label text-king-muted">{title}</p>
    </div>
  )
}

function Origin({ content }: { content: ContentOf<"who.origin"> }) {
  return (
    <section id="origin" aria-labelledby="origin-title" className="relative bg-king-black py-24 md:py-40">
      <div className="mx-auto grid max-w-[1600px] gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-12">
        <div className="lg:col-span-5">
          <SectionIndex n="01" title="The origin" />
          <h2 id="origin-title" data-reveal className="king-display mt-8 text-[clamp(2.75rem,6vw,6rem)] text-king-white">
            {content.title}
            <span className="king-serif block text-king-muted">{content.accent}</span>
          </h2>
          <div data-reveal className="mt-8 space-y-5 text-base leading-relaxed text-king-muted md:text-lg">
            {content.body ? (
              content.body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)
            ) : (
              <>
                <p>This is where the KING 253 story will be told — where it started, who built it and why.</p>
                <Placeholder>Origin story to be supplied by KING 253</Placeholder>
              </>
            )}
          </div>
        </div>
        <figure className="lg:col-span-7">
          <div data-reveal-image className="relative aspect-[16/11] overflow-hidden bg-king-card">
            <div data-speed="6" className="absolute -inset-y-[8%] inset-x-0">
              <Image
                src={content.image}
                alt="Model in a distressed bomber standing under the KING 253 wordmark between a black and a red barrel"
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </figure>
      </div>
    </section>
  )
}

function Culture({ content }: { content: ContentOf<"who.culture"> }) {
  const [w1 = "", w2 = "", w3 = ""] = lines(content.words)
  return (
    <section id="culture" aria-labelledby="culture-title" className="king-grain relative overflow-hidden border-y border-white/[0.06] bg-king-near-black py-24 md:py-40">
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-[70%] w-[70%] -translate-1/2 king-glow [--glow:rgb(92_7_7_/_0.30)]" />
      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <SectionIndex n="02" title="The culture" />
        <h2 id="culture-title" className="sr-only">
          The culture
        </h2>

        <div className="relative mt-12" aria-hidden>
          <p data-reveal className="king-display text-[clamp(4rem,16vw,17rem)] text-king-white">{w1}</p>
          <p data-reveal className="king-serif -mt-[0.1em] text-right text-[clamp(4rem,15vw,16rem)] leading-[0.9] text-king-bright-red">
            {w2}
          </p>
          <p data-reveal className="king-display text-[clamp(4rem,16vw,17rem)] text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.35)]">
            {w3}
          </p>

          <div
            data-reveal-image
            className="relative mt-10 aspect-[4/5] w-full overflow-hidden bg-king-card sm:w-2/3 md:absolute md:top-1/2 md:right-[6%] md:mt-0 md:w-[30%] md:-translate-y-1/2"
          >
            <Image
              src={content.image}
              alt=""
              fill
              sizes="(min-width: 768px) 70vw, 220vw"
              className="object-cover object-[64%_50%]"
            />
          </div>
        </div>

        <p data-reveal className="mt-14 max-w-md text-base leading-relaxed text-king-muted md:text-lg">
          {content.body}
        </p>
      </div>
    </section>
  )
}

/** Framing tuned for the default campaign shots; admin uploads are centred. */
const LOOK_DEFAULTS = [
  { alt: "Distressed graphic hoodie with washed black cargo pants", position: "50% 50%", sizes: "(min-width: 768px) 40vw, 100vw" },
  { alt: "Washed varsity jacket over a white heavyweight tee", position: "67% 50%", sizes: "(min-width: 768px) 70vw, 220vw" },
  { alt: "Canvas work jacket, graphic tee and cargo denim", position: "64% 50%", sizes: "(min-width: 768px) 70vw, 220vw" },
]

function Style({ content }: { content: ContentOf<"who.style"> }) {
  const title = lines(content.title)
  const LOOKS = [
    { src: content.look1, label: content.look1Label },
    { src: content.look2, label: content.look2Label },
    { src: content.look3, label: content.look3Label },
  ].map((look, i) => ({ ...LOOK_DEFAULTS[i], ...look }))
  return (
    <section id="style" aria-labelledby="style-title" className="relative bg-king-black py-24 md:py-40">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionIndex n="03" title="The style" />
            <h2 id="style-title" data-reveal className="king-display mt-8 text-[clamp(2.75rem,7vw,7.5rem)] text-king-white">
              {title.map((line, i) => (
                <span key={`${line}-${i}`} className="block">
                  {i === title.length - 1 ? <RedEnd text={line} /> : line}
                </span>
              ))}
            </h2>
          </div>
          <p data-reveal className="max-w-sm text-base leading-relaxed text-king-muted">
            {content.body}
          </p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-12 md:gap-5">
          {LOOKS.map((look, i) => (
            <figure
              key={`${look.label}-${i}`}
              className={
                i === 0 ? "md:col-span-5 md:row-span-2" : i === 1 ? "md:col-span-7" : "md:col-span-5 md:col-start-8"
              }
            >
              <TiltCard max={6} className={i === 0 ? "aspect-[4/5] md:aspect-auto md:h-[calc(100%-1.75rem)] md:min-h-[640px]" : "aspect-[4/3]"}>
                <div data-reveal-image className="king-chamfer absolute inset-0 overflow-hidden bg-king-card [--cut:18px]">
                  <Image src={look.src} alt={look.alt} fill sizes={look.sizes} className="object-cover" style={{ objectPosition: look.position }} />
                </div>
              </TiltCard>
              <figcaption className="king-label mt-3 text-[0.6rem] text-king-gray">{look.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function Experience({ content }: { content: ContentOf<"who.experience"> }) {
  return (
    <section id="experience" aria-labelledby="experience-title" className="relative isolate flex min-h-svh items-end overflow-hidden bg-king-black">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div data-speed="10" className="absolute -inset-y-[12%] inset-x-0">
          <Image src={content.image} alt="" fill quality={90} sizes="(min-width: 768px) 100vw, 220vw" className="object-cover object-[60%_50%]" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(to_top,#050505_5%,rgba(5,5,5,0.7)_40%,rgba(5,5,5,0.2)_75%,rgba(5,5,5,0.5)_100%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_220px_60px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-24 sm:px-6 md:py-32 lg:px-12">
        <SectionIndex n="04" title="The KING 253 experience" />
        <h2 id="experience-title" data-reveal className="king-display mt-8 max-w-5xl text-[clamp(3rem,9vw,9.5rem)] text-king-white">
          {content.title}
          <span className="king-serif block text-king-bright-red">{content.accent}</span>
        </h2>
        <p data-reveal className="mt-6 max-w-md text-base leading-relaxed text-king-muted md:text-lg">
          {content.body}
        </p>
        <div data-reveal className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="king" size="xl">
            <Link href="/location">
              {content.primaryCta} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="kingOutline" size="xl">
            <Link href="/clothes">{content.secondaryCta}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

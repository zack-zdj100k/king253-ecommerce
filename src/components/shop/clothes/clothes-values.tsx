import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Eye, Heart, Store } from "lucide-react"

import { Logo } from "@/components/layout/logo"
import { Button } from "@/components/ui/button"
import { TiltCard } from "@/components/ui/3d-card"

/** Icons/links for the three feature rows; their words come from the CMS. Only real site features. */
const FEATURE_SLOTS = [
  { icon: Store, href: "/location" },
  { icon: Heart, href: null },
  { icon: Eye, href: null },
]

type BasicsContent = { eyebrow: string; title: string; body: string; link: string; image: string; features: { title: string; text: string }[] }

export function ClothesValues({ content }: { content: BasicsContent }) {
  const FEATURES = content.features.slice(0, 3).map((f, i) => ({ ...FEATURE_SLOTS[i], ...f }))
  return (
    <section id="basics" aria-labelledby="basics-title" className="bg-king-black pb-16 md:pb-24">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 sm:px-6 md:grid-cols-[1fr_1.1fr] lg:grid-cols-[1.1fr_1fr_0.9fr] lg:items-center lg:gap-12 lg:px-12">
        <TiltCard max={6} className="aspect-[16/10]" data-reveal>
          <div className="king-chamfer absolute inset-0 overflow-hidden bg-king-surface-light [--cut:18px]">
            <Image
              src={content.image}
              alt="Model in a washed varsity jacket under red studio spotlights"
              fill
              sizes="(min-width: 1024px) 38vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover object-[62%_50%]"
            />
          </div>
        </TiltCard>

        <div data-reveal>
          <p className="king-label text-[0.6rem] text-king-bright-red">{content.eyebrow}</p>
          <h2 id="basics-title" className="king-display mt-4 text-[clamp(2.25rem,4vw,4rem)] text-king-white">
            {content.title}
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-king-muted">
            {content.body}
          </p>
          <Link
            href="/who-is-king"
            className="king-label group mt-6 inline-flex items-center gap-3 text-[0.65rem] text-king-white"
          >
            {content.link}
            <ArrowRight className="size-4 transition-transform duration-500 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>

        <ul className="grid gap-6 border-white/10 md:col-span-2 md:grid-cols-3 lg:col-span-1 lg:grid-cols-1 lg:border-l lg:pl-12">
          {FEATURES.map(({ icon: Icon, title, text, href }, i) => {
            const body = (
              <>
                <span className="grid size-11 shrink-0 place-items-center border border-white/15 text-king-bright-red transition-colors group-hover:border-king-bright-red">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="king-label block text-[0.65rem] text-king-white">{title}</span>
                  <span className="mt-1 block text-sm text-king-gray">{text}</span>
                </span>
              </>
            )
            return (
              <li key={`${title}-${i}`} data-reveal>
                {href ? (
                  <Link href={href} className="group flex items-start gap-4">
                    {body}
                  </Link>
                ) : (
                  <div className="group flex items-start gap-4">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function JoinBand({ content }: { content: { line1: string; line2: string; button: string } }) {
  return (
    <section id="join" aria-label="Join KING 253" className="border-t border-white/[0.06] bg-king-near-black">
      <div className="mx-auto flex max-w-[1600px] flex-col items-start gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-12">
        <Logo />
        <p className="king-label text-[0.65rem] leading-relaxed text-king-white md:text-center">
          {content.line1}
          <br />
          <span className="text-king-gray">{content.line2}</span>
        </p>
        <Button asChild variant="king" size="xl">
          <Link href="/sign-up">
            {content.button} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  )
}

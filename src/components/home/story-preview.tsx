import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Eyebrow, RedEnd } from "@/components/layout/editorial"

type StoryContent = { eyebrow: string; title: string; description: string; button: string; image: string }

export function StoryPreview({ content }: { content: StoryContent }) {
  const title = content.title.split("\n").map((l) => l.trim()).filter(Boolean)
  return (
    <section id="story" aria-labelledby="story-title" className="relative bg-king-black py-24 md:py-36">
      <div className="mx-auto grid max-w-[1600px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-12">
        <div data-reveal-image className="relative aspect-[4/3] overflow-hidden bg-king-card lg:col-span-7 lg:aspect-[16/11]">
          <div data-speed="7" className="absolute -inset-y-[10%] inset-x-0">
            <Image
              src={content.image}
              alt="Model in a canvas work jacket and cargo denim beside black and red barrels in the KING 253 studio"
              fill
              sizes="(min-width: 1024px) 60vw, 140vw"
              className="object-cover object-[62%_50%]"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-king-black/40" />
        </div>

        <div className="lg:col-span-5">
          <div data-reveal>
            <Eyebrow>{content.eyebrow}</Eyebrow>
          </div>
          <h2 id="story-title" data-reveal className="king-display mt-6 text-[clamp(3rem,7vw,7.5rem)] text-king-white">
            {title.map((line, i) => (
              <span key={`${line}-${i}`} className="block">
                {i === title.length - 1 ? <RedEnd text={line} /> : line}
              </span>
            ))}
          </h2>
          <p data-reveal className="mt-6 max-w-sm text-base leading-relaxed text-king-muted md:text-lg">
            {content.description}
          </p>
          <div data-reveal className="mt-10">
            <Button asChild variant="kingOutline" size="xl">
              <Link href="/who-is-king">
                {content.button} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

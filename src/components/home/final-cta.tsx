import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export function FinalCTA({ content }: { content: { lines: string; button: string; background: string } }) {
  const rows = content.lines.split("\n").map((l) => l.trim()).filter(Boolean)
  return (
    <section id="final-cta" aria-labelledby="final-title" className="relative isolate overflow-hidden bg-king-black py-32 md:py-48">
      <div className="absolute inset-0 -z-10">
        <Image src={content.background} alt="" fill sizes="100vw" className="object-cover opacity-30 blur-[1px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(163,13,13,0.35)_0%,rgba(5,5,5,0.85)_55%,#050505_100%)]" />
      </div>

      <div className="mx-auto max-w-[1600px] px-4 text-center sm:px-6 lg:px-12">
        <h2 id="final-title" className="king-display text-[clamp(3rem,10vw,10.5rem)] text-king-white">
          {rows.map((row, i) => (
            <span
              key={`${row}-${i}`}
              data-reveal
              className={i === rows.length - 1 && rows.length > 1 ? "king-serif block leading-[0.95] text-king-bright-red" : "block"}
            >
              {row}
            </span>
          ))}
        </h2>
        <div data-reveal className="mt-14 flex justify-center">
          <Button asChild variant="king" size="xl">
            <Link href="/clothes">
              {content.button} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

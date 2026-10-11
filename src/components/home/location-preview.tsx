import Image from "next/image"
import Link from "next/link"
import { MapPin } from "lucide-react"

import { db } from "@/server/db"
import { listStores } from "@/server/stores"
import { Button } from "@/components/ui/button"
import { Eyebrow, Placeholder, RedEnd } from "@/components/layout/editorial"

type ShopsContent = { eyebrow: string; title: string; description: string; button: string; image: string }

export async function LocationPreview({ content }: { content: ShopsContent }) {
  const stores = await listStores(db, { activeOnly: true })
  const title = content.title.split("\n").map((l) => l.trim()).filter(Boolean)
  return (
    <section id="shops" aria-labelledby="find-title" className="king-grain relative isolate overflow-hidden bg-king-black">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div data-speed="9" className="absolute -inset-y-[12%] inset-x-0">
          <Image
            src={content.image}
            alt=""
            fill
            sizes="(min-width: 768px) 100vw, 200vw"
            className="object-cover object-[64%_50%] saturate-[1.15]"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#050505_0%,rgba(5,5,5,0.88)_35%,rgba(92,7,7,0.35)_70%,rgba(5,5,5,0.6)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-king-black via-transparent to-king-black/70" />
      </div>

      <div className="mx-auto flex min-h-[80svh] max-w-[1600px] flex-col justify-center px-4 py-28 sm:px-6 lg:px-12">
        <div data-reveal>
          <Eyebrow>{content.eyebrow}</Eyebrow>
        </div>
        <h2 id="find-title" data-reveal className="king-display mt-6 text-[clamp(3.25rem,10vw,10rem)] text-king-white">
          {title.map((line, i) => (
            <span key={`${line}-${i}`} className="block">
              {i === title.length - 1 ? <RedEnd text={line} /> : line}
            </span>
          ))}
        </h2>
        <p data-reveal className="mt-6 max-w-md text-base leading-relaxed text-king-muted md:text-lg">
          {content.description}
        </p>
        {stores.length ? (
          <ul data-reveal className="mt-8 space-y-2 text-sm text-king-muted">
            {stores.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <MapPin className="size-4 shrink-0 text-king-bright-red" aria-hidden />
                <span>
                  <span className="text-king-white">{s.name}</span> — {s.city}, {s.wilaya}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div data-reveal className="mt-8 flex items-center gap-3 text-sm text-king-muted">
            <MapPin className="size-4 text-king-bright-red" aria-hidden />
            <Placeholder>Shop addresses to be announced</Placeholder>
          </div>
        )}
        <div data-reveal className="mt-10">
          <Button asChild variant="king" size="xl">
            <Link href="/location">{content.button}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

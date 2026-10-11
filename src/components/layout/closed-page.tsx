import Image from "next/image"
import Link from "next/link"
import { AtSign, Clock, MessageCircle, Phone } from "lucide-react"

import { IMAGES } from "@/lib/site"
import { formatClosureDate } from "@/lib/closure"
import { formatPhone, normalizePhone, whatsappLink } from "@/lib/phone"
import type { Settings } from "@/server/settings"
import { TrackOrder } from "@/components/orders/track-order"

/**
 * What visitors see while the shop is closed (vacation mode). Same studio look
 * as the site; orders are paused but existing orders can still be tracked.
 */
export function ClosedPage({ settings, until }: { settings: Settings; until: Date | null }) {
  const whatsapp = settings.whatsapp ? normalizePhone(settings.whatsapp) : null
  const instagram = settings.instagram
    ? settings.instagram.startsWith("http")
      ? settings.instagram
      : `https://instagram.com/${settings.instagram.replace(/^@/, "")}`
    : null
  const link = "king-label inline-flex h-11 items-center gap-2 border border-white/15 px-4 text-[0.6rem] text-king-white transition-colors hover:border-king-bright-red hover:bg-king-red/15"

  return (
    <main id="main" className="bg-king-black">
      <section className="king-grain relative isolate flex min-h-svh flex-col justify-center overflow-hidden px-4 py-20 sm:px-6 lg:px-12">
        <div className="absolute inset-0 -z-10">
          <Image src={IMAGES.homeBackground} alt="" fill preload sizes="100vw" className="object-cover object-top" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_0%,rgba(5,5,5,0.35)_40%,rgba(5,5,5,0.85)_80%,#050505_100%)]" />
        </div>

        <div className="mx-auto w-full max-w-[1200px]">
          <p className="text-xl font-black tracking-[-0.03em] text-king-white uppercase">
            King <span className="text-king-bright-red">253</span>
          </p>
          <p className="king-label mt-14 flex items-center gap-3 text-[0.6rem] text-king-bright-red">
            <span className="size-1.5 animate-pulse rounded-full bg-king-bright-red motion-reduce:animate-none" aria-hidden />
            Closed for now
          </p>
          <h1 className="king-display mt-5 text-[clamp(3.5rem,13vw,10rem)] text-king-white">
            We&apos;ll be
            <br />
            back<span className="text-king-bright-red">.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-king-muted">
            {settings.closedMessage || "The shop is taking a short break. Orders are paused for now — thank you for your patience."}
          </p>
          {until && (
            <p className="mt-6 inline-flex items-center gap-3 border border-king-red-line bg-king-red/15 px-4 py-3 text-king-white">
              <Clock className="size-4 text-king-bright-red" aria-hidden />
              <span>
                Back on <strong className="font-semibold">{formatClosureDate(until)}</strong>
              </span>
            </p>
          )}

          {(settings.contactPhone || whatsapp || instagram) && (
            <div className="mt-10 flex flex-wrap gap-2">
              {settings.contactPhone && (
                <a href={`tel:${normalizePhone(settings.contactPhone) ?? settings.contactPhone}`} className={link}>
                  <Phone className="size-3.5" aria-hidden /> {formatPhone(settings.contactPhone)}
                </a>
              )}
              {whatsapp && (
                <a href={whatsappLink(whatsapp)} target="_blank" rel="noreferrer" className={link}>
                  <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
                </a>
              )}
              {instagram && (
                <a href={instagram} target="_blank" rel="noreferrer" className={link}>
                  <AtSign className="size-3.5" aria-hidden /> Instagram
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-5xl">
          <p className="king-label text-[0.6rem] text-king-gray">[ Already ordered? ]</p>
          <h2 className="king-display mt-4 text-[clamp(2.25rem,6vw,4.5rem)] text-king-white">Track your order.</h2>
          <p className="mt-3 max-w-lg text-sm text-king-muted">Orders placed before the break are still on their way. Enter your order number and phone.</p>
          <div className="mt-10">
            <TrackOrder initialNumber="" />
          </div>
        </div>
      </section>

      <p className="king-label px-4 pb-10 text-center text-[0.55rem] text-king-gray">
        © {new Date().getFullYear()} {settings.brandName} · <Link href="/admin/login" className="hover:text-king-white">Staff</Link>
      </p>
    </main>
  )
}

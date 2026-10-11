import type { Metadata } from "next"
import { AtSign, Globe, Mail, MessageCircle, Music2, Phone } from "lucide-react"

import { normalizePhone, whatsappLink } from "@/lib/phone"

import { db } from "@/server/db"
import { getSettings } from "@/server/settings"
import { listStores } from "@/server/stores"
import { getContent } from "@/server/content"
import { StoreFinder } from "@/components/location/store-finder"
import { PageHero, Placeholder, RedEnd } from "@/components/layout/editorial"

export const metadata: Metadata = {
  title: "Find the King",
  description: "KING 253 shops in Algeria — addresses, opening hours, directions. Find the shop closest to you.",
}

export const dynamic = "force-dynamic"

export default async function LocationPage() {
  const [settings, stores, hero, body] = await Promise.all([
    getSettings(db),
    listStores(db, { activeOnly: true }),
    getContent(db, "location.hero"),
    getContent(db, "location.body"),
  ])
  // Contact & social links from Admin → Settings; only filled ones are shown.
  const handle = (v: string) => v.replace(/^@/, "")
  const whatsapp = settings.whatsapp ? normalizePhone(settings.whatsapp) : null
  const contacts = [
    settings.contactPhone && { icon: Phone, label: body.callLabel, text: settings.contactPhone, href: `tel:${settings.contactPhone.replace(/\s/g, "")}`, external: false },
    whatsapp && { icon: MessageCircle, label: "WhatsApp", text: settings.whatsapp, href: whatsappLink(whatsapp), external: true },
    settings.contactEmail && { icon: Mail, label: "Email", text: settings.contactEmail, href: `mailto:${settings.contactEmail}`, external: false },
    settings.instagram && {
      icon: AtSign,
      label: "Instagram",
      text: settings.instagram.startsWith("http") ? "Instagram" : `@${handle(settings.instagram)}`,
      href: settings.instagram.startsWith("http") ? settings.instagram : `https://instagram.com/${handle(settings.instagram)}`,
      external: true,
    },
    settings.tiktok && {
      icon: Music2,
      label: "TikTok",
      text: settings.tiktok.startsWith("http") ? "TikTok" : `@${handle(settings.tiktok)}`,
      href: settings.tiktok.startsWith("http") ? settings.tiktok : `https://www.tiktok.com/@${handle(settings.tiktok)}`,
      external: true,
    },
    settings.facebook && { icon: Globe, label: "Facebook", text: "Facebook", href: settings.facebook, external: true },
  ].filter((c): c is { icon: typeof Phone; label: string; text: string; href: string; external: boolean } => !!c)

  return (
    <>
      <PageHero
        eyebrow={hero.eyebrow}
        title={<RedEnd text={hero.title} />}
        subtitle={hero.subtitle}
        image={hero.image}
        imagePosition="40% 50%"
      />

      <section id="shops" aria-label="Shops" className="relative bg-king-black py-20 md:py-32">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
          {stores.length ? (
            <StoreFinder
              findLabel={body.findButton}
              stores={stores.map((s) => ({
                id: s.id,
                name: s.name,
                wilaya: s.wilaya,
                city: s.city,
                address: s.address,
                phone: s.phone,
                hours: s.hours,
                mapUrl: s.mapUrl,
                latitude: s.latitude,
                longitude: s.longitude,
              }))}
            />
          ) : (
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="self-center lg:col-span-5">
                <Placeholder>{body.emptyTitle}</Placeholder>
                <p className="mt-6 max-w-md text-king-muted">{body.emptyText}</p>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden border border-white/10 bg-king-near-black lg:col-span-7 lg:aspect-[16/11]">
                <MapPlaceholder />
              </div>
            </div>
          )}

          {stores.length > 0 && body.delivery && <p className="mt-12 max-w-xl text-sm leading-relaxed text-king-gray">{body.delivery}</p>}

          {contacts.length > 0 && (
            <dl className="mt-16 grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {contacts.map((c) => (
                <InfoRow key={c.label} icon={c.icon} label={c.label}>
                  <a href={c.href} target={c.external ? "_blank" : undefined} rel={c.external ? "noreferrer" : undefined} className="break-words hover:text-king-bright-red">
                    {c.text}
                  </a>
                </InfoRow>
              ))}
            </dl>
          )}
        </div>
      </section>
    </>
  )
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div data-reveal className="bg-king-black p-6 md:p-8">
      <dt className="king-label flex items-center gap-3 text-king-gray">
        <Icon className="size-4 text-king-bright-red" aria-hidden />
        {label}
      </dt>
      <dd className="mt-4 text-lg leading-snug text-king-white">{children}</dd>
    </div>
  )
}

function MapPlaceholder() {
  return (
    <div className="absolute inset-0" role="img" aria-label="Map placeholder — shop locations will appear here once confirmed">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:12px_12px]" />
      <div className="absolute top-[38%] -left-[10%] h-px w-[120%] -rotate-12 bg-white/15" />
      <div className="absolute top-0 left-[58%] h-full w-px rotate-6 bg-white/15" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_45%,rgba(163,13,13,0.35)_0%,transparent_45%)]" />
      <div className="absolute top-[45%] left-[58%] -translate-1/2">
        <span className="absolute inset-0 animate-ping rounded-full bg-king-bright-red/60 motion-reduce:animate-none" />
        <span className="relative block size-3.5 rounded-full bg-king-bright-red shadow-[0_0_24px_4px_rgba(255,26,26,0.6)]" />
      </div>
      <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4">
        <p className="king-display text-3xl text-king-white md:text-5xl">KING 253</p>
        <Placeholder>Map pending address</Placeholder>
      </div>
    </div>
  )
}

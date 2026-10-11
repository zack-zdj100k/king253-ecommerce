import Link from "next/link"
import { ArrowRight, Crown } from "lucide-react"

import { NAV_LINKS } from "@/lib/site"
import { db } from "@/server/db"
import { getCatalogFacets } from "@/server/catalog"
import { getSettings } from "@/server/settings"
import { listStores } from "@/server/stores"
import { formatPhone, normalizePhone, whatsappLink } from "@/lib/phone"
import { Button } from "@/components/ui/button"
import { GraffitiWordmark } from "@/components/ui/graffiti-wordmark"

const linkClass = "text-sm text-king-gray transition-colors duration-300 hover:text-king-white"

/**
 * Large-name footer: brand block + link columns, closed by a 3D graffiti
 * KING 253 piece. Store details come from STORE and stay marked until supplied.
 */
async function Footer() {
  const [settings, facets, stores] = await Promise.all([getSettings(db), getCatalogFacets(db).catch(() => null), listStores(db, { activeOnly: true })])
  const categories = facets?.categories ?? []
  const phone = settings.contactPhone ? normalizePhone(settings.contactPhone) : null
  const whatsapp = settings.whatsapp ? normalizePhone(settings.whatsapp) : null
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-king-black px-4 pt-16 pb-6 md:px-6 md:pt-20 lg:px-12">
      <div aria-hidden className="pointer-events-none absolute -bottom-1/3 left-1/2 h-2/3 w-[80%] -translate-x-1/2 king-glow [--glow:rgb(92_7_7_/_0.25)]" />

      <div className="relative mx-auto max-w-[1600px]">
        <div className="flex flex-col justify-between gap-12 md:flex-row">
          {/* Brand block */}
          <div className="max-w-sm">
            <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="KING 253 — home">
              <Crown className="size-6 -rotate-6 text-king-bright-red transition-transform duration-500 group-hover:rotate-0" aria-hidden />
              <span className="text-lg font-black tracking-[-0.04em] text-king-white uppercase">
                King <span className="text-king-bright-red">253</span>
              </span>
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-king-muted">
              Modern American-inspired streetwear for those who move differently.
            </p>
            <div className="mt-5">
              <Button asChild variant="kingOutline" size="xl">
                <Link href="/sign-up">
                  Join the club <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-king-gray">
              &copy; {new Date().getFullYear()} KING 253. All rights reserved.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 lg:gap-x-14">
            <FooterColumn title="Shop">
              <li>
                <Link href="/clothes" className={linkClass}>
                  All clothes
                </Link>
              </li>
              {categories.slice(0, 4).map((c) => (
                <li key={c.slug}>
                  <Link href={`/clothes?category=${c.slug}#catalog`} className={linkClass}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </FooterColumn>

            <FooterColumn title="KING 253">
              {NAV_LINKS.slice(2).map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/account" className={linkClass}>
                  Account
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className={linkClass}>
                  Wishlist
                </Link>
              </li>
            </FooterColumn>

            <FooterColumn title="Visit">
              {stores.length ? (
                stores.map((s) => (
                  <li key={s.id} className="text-sm text-king-gray">
                    {s.city}, {s.wilaya}
                  </li>
                ))
              ) : (
                <li className="text-sm text-king-gray">Shops to be announced</li>
              )}
              <li className="text-sm text-king-gray">{phone ? <a href={`tel:${phone}`} className="hover:text-king-white">{formatPhone(phone)}</a> : settings.contactPhone || "Phone to be announced"}</li>
              {settings.contactEmail && (
                <li className="text-sm text-king-gray">
                  <a href={`mailto:${settings.contactEmail}`} className="hover:text-king-white">
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              <li>
                <Link href="/location" className={linkClass}>
                  {stores.length > 1 ? "Find the closest shop" : "Find the shop"}
                </Link>
              </li>
            </FooterColumn>

            <FooterColumn title="Socials">
              <li>
                {settings.instagram ? (
                  <a
                    href={settings.instagram.startsWith("http") ? settings.instagram : `https://instagram.com/${settings.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className={linkClass}
                  >
                    Instagram
                  </a>
                ) : (
                  <span className="text-sm text-king-gray">Instagram — soon</span>
                )}
              </li>
              {settings.tiktok && (
                <li>
                  <a href={settings.tiktok.startsWith("http") ? settings.tiktok : `https://www.tiktok.com/@${settings.tiktok.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className={linkClass}>
                    TikTok
                  </a>
                </li>
              )}
              {whatsapp && (
                <li>
                  <a href={whatsappLink(whatsapp)} target="_blank" rel="noreferrer" className={linkClass}>
                    WhatsApp
                  </a>
                </li>
              )}
              {settings.facebook && (
                <li>
                  <a href={settings.facebook} target="_blank" rel="noreferrer" className={linkClass}>
                    Facebook
                  </a>
                </li>
              )}
              <li>
                <Link href="/track" className={linkClass}>
                  Track an order
                </Link>
              </li>
            </FooterColumn>
          </div>
        </div>

        {/* The large name — 3D graffiti */}
        <div className="mt-14 md:mt-20">
          <GraffitiWordmark />
        </div>

        <DeveloperCredit settings={settings} />
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="king-label mb-4 text-[0.65rem] text-king-white">{title}</h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  )
}

export { Footer }

/** "Developed by" line — from Admin → Settings; hidden while nothing is filled in. */
function DeveloperCredit({ settings }: { settings: { developerName: string; developerPhone: string; developerEmail: string; developerGithub: string } }) {
  const { developerName: name, developerPhone: phoneRaw, developerEmail: email, developerGithub: githubRaw } = settings
  if (!name && !phoneRaw && !email && !githubRaw) return null
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null
  const github = githubRaw
    ? githubRaw.startsWith("http")
      ? { href: githubRaw, label: githubRaw.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "") || "GitHub" }
      : { href: `https://github.com/${githubRaw.replace(/^@/, "")}`, label: githubRaw.replace(/^@/, "") }
    : null
  const link = "transition-colors hover:text-king-white"
  return (
    <p className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-6 text-xs text-king-gray">
      <span>
        Developed by <span className="text-king-muted">{name || "the developer"}</span>
      </span>
      {phoneRaw && (
        <a href={phone ? `tel:${phone}` : undefined} className={link}>
          {phone ? formatPhone(phone) : phoneRaw}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={link}>
          {email}
        </a>
      )}
      {github && (
        <a href={github.href} target="_blank" rel="noreferrer" className={link}>
          GitHub · {github.label}
        </a>
      )}
    </p>
  )
}

import type { Metadata } from "next"
import Image from "next/image"

import { LOCALES, LOCALE_NAMES, localePath, type Locale } from "@/i18n/config"

export const metadata: Metadata = { title: { absolute: "KING 253 — Language · Langue · اللغة" }, robots: { index: false, follow: true } }

const LINES: Record<Locale, { pick: string; sub: string }> = {
  ar: { pick: "اختر لغتك", sub: "يمكنك تغييرها لاحقًا من أسفل الصفحة" },
  fr: { pick: "Choisis ta langue", sub: "Tu pourras la changer en bas de page" },
  en: { pick: "Choose your language", sub: "You can change it later in the footer" },
}

/** Same-site path only (no //evil.com, no scheme). */
function safeNext(v: unknown) {
  const s = typeof v === "string" ? v : "/"
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/language") ? s : "/"
}

/**
 * First visit, whatever page was opened: pick a language, then go straight to
 * that page (path + query kept). The /ar /fr /en link saves the choice.
 */
export default async function LanguagePage({ searchParams }: PageProps<"/language">) {
  const next = safeNext((await searchParams).next)
  const q = next.indexOf("?")
  const path = q === -1 ? next : next.slice(0, q)
  const query = q === -1 ? "" : next.slice(q + 1)
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-king-black px-4 py-16 text-king-white">
      <Image src="/images/backgrounds/home-background.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,20,20,0.35),transparent_60%),linear-gradient(to_bottom,rgba(5,5,5,0.4),#050505_85%)]" />
      <div className="relative w-full max-w-3xl text-center">
        <p className="king-label text-[0.625rem] text-king-gray" dir="ltr">
          KING <span className="text-king-bright-red">253</span> · Built for the city
        </p>
        <div className="mt-6 space-y-1">
          {LOCALES.map((l) => (
            <p key={l} lang={l} dir={l === "ar" ? "rtl" : "ltr"} className={l === "ar" ? "text-2xl font-bold" : "king-display text-[clamp(1.6rem,5vw,3rem)]"}>
              {LINES[l].pick}
            </p>
          ))}
        </div>
        <ul className="mt-12 grid gap-3 sm:grid-cols-3">
          {LOCALES.map((l) => (
            <li key={l}>
              {/* A full page load (not client navigation) so <html lang dir> switch with the language. */}
              <a
                href={`${localePath(l, path || "/")}${query ? `?${query}` : ""}`}
                lang={l}
                hrefLang={l}
                className="king-chamfer group flex h-full flex-col items-center gap-2 border border-white/15 bg-black/50 px-6 py-8 backdrop-blur-md transition-colors [--cut:16px] hover:border-king-bright-red hover:bg-king-red/20 focus-visible:border-king-bright-red focus-visible:outline-none"
              >
                <span dir={l === "ar" ? "rtl" : "ltr"} className={l === "ar" ? "text-3xl font-black" : "king-display text-3xl"}>
                  {LOCALE_NAMES[l]}
                </span>
                <span lang={l} dir={l === "ar" ? "rtl" : "ltr"} className="text-xs text-king-gray group-hover:text-king-muted">
                  {LINES[l].sub}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

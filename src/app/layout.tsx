import type { Metadata, Viewport } from "next"
import { Inter, Instrument_Serif, Noto_Kufi_Arabic } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"

import "./globals.css"
import { NavigationTracker } from "@/components/ui/back-button"
import { dirOf } from "@/i18n/config"
import { currentLocale } from "@/i18n/request"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

/** Arabic: one geometric Kufi family, heavy for headlines, regular for text. */
const kufi = Noto_Kufi_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
})

const TITLES = {
  en: { title: "KING 253 — Men's Streetwear", description: "Modern American-inspired streetwear for those who move differently. Built for the city." },
  fr: { title: "KING 253 — Streetwear homme", description: "Streetwear moderne d'inspiration américaine pour ceux qui avancent autrement. Fait pour la ville." },
  ar: { title: "KING 253 — ستريت وير رجالي", description: "ستريت وير عصري بروح أمريكية لمن يتحرك بطريقته الخاصة. صُنع للمدينة." },
} as const

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale()
  const t = TITLES[locale]
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: t.title, template: "%s — KING 253" },
    description: t.description,
    // Link previews (WhatsApp, Instagram, Facebook, Google): site name + a campaign photo.
    openGraph: {
      type: "website",
      siteName: "KING 253",
      title: t.title,
      description: t.description,
      locale: locale === "ar" ? "ar_DZ" : locale === "fr" ? "fr_DZ" : "en_US",
      images: [{ url: "/images/hero/2.jpg", width: 2752, height: 1536, alt: "KING 253" }],
    },
    twitter: { card: "summary_large_image", title: t.title, description: t.description, images: ["/images/hero/2.jpg"] },
  }
}

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await currentLocale()
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${inter.variable} ${instrumentSerif.variable} ${kufi.variable}`} suppressHydrationWarning>
      <head>
        {/* Lets CSS hide animated elements before GSAP runs — only when JS is available. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-svh antialiased">
        <NextIntlClientProvider>
          <NavigationTracker />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

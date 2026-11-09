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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "KING 253 — Men's Streetwear",
    template: "%s — KING 253",
  },
  description: "Modern American-inspired streetwear for those who move differently. Built for the city.",
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

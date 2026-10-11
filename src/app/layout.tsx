import type { Metadata, Viewport } from "next"
import { Inter, Instrument_Serif } from "next/font/google"

import "./globals.css"
import { NavigationTracker } from "@/components/ui/back-button"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`} suppressHydrationWarning>
      <head>
        {/* Lets CSS hide animated elements before GSAP runs — only when JS is available. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-svh antialiased">
        <NavigationTracker />
        {children}
      </body>
    </html>
  )
}

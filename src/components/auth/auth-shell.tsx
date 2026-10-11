import Image from "next/image"

import { IMAGES } from "@/lib/site"
import { BackButton } from "@/components/ui/back-button"

/** Full-bleed red brick wall with a single card centred on it. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="king-grain relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-king-black px-4 pt-24 pb-16">
      <div className="absolute inset-0 -z-10">
        <Image src={IMAGES.homeBackground} alt="" fill preload sizes="100vw" className="object-cover object-top saturate-[1.1]" />
        {/* Studio light from above, falling off into black at the edges */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_0%,rgba(5,5,5,0.15)_40%,rgba(5,5,5,0.75)_85%,#050505_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-king-black to-transparent" />
      </div>

      <BackButton fallback="/" className="mb-3 w-full max-w-[26rem]" />
      {children}
    </section>
  )
}

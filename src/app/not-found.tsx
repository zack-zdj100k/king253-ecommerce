import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <section className="king-grain relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-king-black px-4 text-center">
      <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 h-1/2 w-2/3 -translate-x-1/2 king-glow [--glow:rgb(92_7_7_/_0.40)]" />
      <p className="king-label relative text-king-bright-red">Error 404</p>
      <h1 className="king-display relative mt-6 text-[clamp(3.5rem,12vw,10rem)] text-king-white">Wrong block.</h1>
      <p className="king-serif relative mt-4 text-2xl text-king-muted md:text-3xl">This page doesn&apos;t exist.</p>
      <Button asChild variant="king" size="xl" className="relative mt-10">
        <Link href="/">Back to KING 253</Link>
      </Button>
    </section>
  )
}

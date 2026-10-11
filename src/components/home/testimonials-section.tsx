import { Eyebrow } from "@/components/layout/editorial"
import { TestimonialsColumns, type Testimonial } from "@/components/ui/testimonials-columns-1"

/** Renders nothing until an admin publishes testimonials — no invented social proof. */
export function TestimonialsSection({ testimonials, content }: { testimonials: Testimonial[]; content: { eyebrow: string; title: string } }) {
  if (!testimonials.length) return null
  return (
    <section id="testimonials" aria-labelledby="testimonials-title" className="relative overflow-hidden bg-king-black py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-2/3 w-2/3 -translate-1/2 king-glow [--glow:rgb(92_7_7_/_0.25)]" />
      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-xl text-center">
          <div data-reveal className="flex justify-center">
            <Eyebrow>{content.eyebrow}</Eyebrow>
          </div>
          <h2 id="testimonials-title" data-reveal className="king-display mt-6 text-[clamp(2.5rem,6vw,5.5rem)] text-king-white">
            {content.title}
          </h2>
        </div>
        <TestimonialsColumns testimonials={testimonials} className="mt-14" />
      </div>
    </section>
  )
}

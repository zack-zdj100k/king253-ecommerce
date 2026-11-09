import type { Metadata } from "next"
import Link from "next/link"

import { db } from "@/server/db"
import { contentBlocks } from "@/server/db/schema"
import { CONTENT_PAGES, CONTENT_SECTIONS, SECTION_ANCHORS, type ContentPage } from "@/server/content"
import { CONTENT_DEFAULTS_I18N } from "@/server/content-i18n"
import { ContentEditor } from "@/components/admin/content-editor"
import { PageHeader, pill } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Content" }

const PAGE_INFO: Record<ContentPage, { slug: string; href: string; intro: string }> = {
  Home: { slug: "home", href: "/", intro: "Hero, brand statement, editorial, categories, story, shops preview and the final call to action." },
  "Who Is King": { slug: "who", href: "/who-is-king", intro: "The brand story page — header, origin, culture, style and the studio experience." },
  Location: { slug: "location", href: "/location", intro: "Header and texts around the shop list. Shop addresses, hours and phones are in Locations." },
  Clothes: { slug: "clothes", href: "/clothes", intro: "Texts and images around the products. Products themselves are managed in Products." },
}

export default async function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  const sp = await searchParams
  const requested = sp.page
  const lang = sp.lang === "fr" || sp.lang === "ar" ? sp.lang : "en"
  const page = CONTENT_PAGES.find((p) => PAGE_INFO[p].slug === requested) ?? "Home"
  const info = PAGE_INFO[page]
  const rows = await db.select().from(contentBlocks)
  const stored = new Map(rows.map((r) => [r.key, r.data as Record<string, string>]))
  const sections = Object.entries(CONTENT_SECTIONS).filter(([, s]) => s.page === page)

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content management" title="Website content">
        <p className="mt-2 max-w-3xl text-sm text-king-gray">
          Change the words and images of the website. Empty fields keep the approved copy (shown in grey). The design and layout stay exactly the same.
        </p>
      </PageHeader>

      <nav aria-label="Pages" className="flex flex-wrap gap-2">
        {CONTENT_PAGES.map((p) => (
          <Link key={p} href={`/admin/content?page=${PAGE_INFO[p].slug}`} aria-current={p === page ? "page" : undefined} className={pill(p === page)}>
            {p}
          </Link>
        ))}
      </nav>
      <nav aria-label="Language" className="flex flex-wrap items-center gap-2">
        {(["en", "fr", "ar"] as const).map((l) => (
          <Link key={l} href={`/admin/content?page=${info.slug}&lang=${l}`} className={pill(l === lang)}>
            {l === "en" ? "English (+ images)" : l === "fr" ? "Français" : "العربية"}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-king-gray">
        {info.intro}
        {lang !== "en" && " Empty fields show the built-in translation (in grey)."}
      </p>

      <div className="space-y-5">
        {sections.map(([key, s]) => (
          <ContentEditor
            key={`${key}-${lang}`}
            locale={lang}
            sectionKey={key}
            label={s.label}
            help={"help" in s ? s.help : undefined}
            previewHref={SECTION_ANCHORS[key] ? `${info.href}#${SECTION_ANCHORS[key]}` : info.href}
            fields={[...s.fields]}
            defaults={
              lang === "en"
                ? (s.defaults as Record<string, string>)
                : { ...(s.defaults as Record<string, string>), ...(CONTENT_DEFAULTS_I18N[lang][key] ?? {}) }
            }
            values={Object.fromEntries(s.fields.map((f) => [f.name, stored.get(lang === "en" ? key : `${key}@${lang}`)?.[f.name] ?? ""]))}
          />
        ))}
      </div>
    </div>
  )
}

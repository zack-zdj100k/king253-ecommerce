import { eq } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { contentBlocks } from "./db/schema"
import { IMAGES } from "@/lib/site"
import { CATEGORY_CROPS, DEFAULT_CATEGORIES } from "@/lib/products"

/*
 * CMS sections. Defaults are the approved website copy, so the site looks the
 * same until an admin edits something. Empty values fall back to the default.
 */

export type ContentField = {
  name: string
  label: string
  type: "text" | "textarea" | "lines" | "image"
  help?: string
}

export const CONTENT_PAGES = ["Home", "Who Is King", "Location", "Clothes"] as const
export type ContentPage = (typeof CONTENT_PAGES)[number]

type Section = { label: string; page: ContentPage; fields: ContentField[]; defaults: Record<string, string> }

/** Where each section sits on its page (element id), for the admin "View on page" link. */
export const SECTION_ANCHORS: Record<string, string> = {
  "home.hero": "hero",
  "home.mindset": "mindset",
  "home.latestDrop": "latest-drop",
  "home.attitude": "attitude",
  "home.categories": "categories",
  "home.testimonials": "testimonials",
  "home.story": "story",
  "home.location": "shops",
  "home.finalCta": "final-cta",
  "who.hero": "top",
  "who.origin": "origin",
  "who.culture": "culture",
  "who.style": "style",
  "who.experience": "experience",
  "location.hero": "top",
  "location.body": "shops",
  "clothes.hero": "collection",
  "clothes.look": "look",
  "clothes.basics": "basics",
  "clothes.join": "join",
}

const img = (name: string, label: string, help?: string): ContentField => ({ name, label, type: "image", help })
const text = (name: string, label: string, help?: string): ContentField => ({ name, label, type: "text", help })
const area = (name: string, label: string, help?: string): ContentField => ({ name, label, type: "textarea", help })
const rows = (name: string, label: string, help?: string): ContentField => ({ name, label, type: "lines", help })

export const CONTENT_SECTIONS = {
  /* ---------------------------------------------------------------- Home */
  "home.hero": {
    label: "Hero",
    page: "Home",
    fields: [
      text("eyebrow", "Eyebrow"),
      rows("headline", "Headline (one line per row)"),
      text("secondary", "Secondary line"),
      area("description", "Description"),
      text("primaryCta", "Primary button"),
      text("secondaryCta", "Secondary button"),
      img("slide1", "Slideshow — look 1"),
      img("slide2", "Slideshow — look 2"),
      img("slide3", "Slideshow — look 3"),
      img("slide4", "Slideshow — look 4"),
      img("background", "Background (brick wall)"),
    ],
    defaults: {
      eyebrow: "KING 253 / Men's Streetwear",
      headline: "Built\nfor the\ncity.",
      secondary: "Own your style",
      description: "Modern American-inspired streetwear for those who move differently.",
      primaryCta: "Shop the collection",
      secondaryCta: "Discover KING 253",
      slide1: IMAGES.studio02,
      slide2: IMAGES.studio03,
      slide3: IMAGES.studio04,
      slide4: IMAGES.studio05,
      background: IMAGES.homeBackground,
    },
  },
  "home.mindset": {
    label: "Brand statement",
    page: "Home",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("headline", "Headline"),
      text("accent", "Accent line"),
      area("description", "Description"),
      rows("pillars", "Pillars (one per line, 3 recommended)"),
    ],
    defaults: {
      eyebrow: "The KING 253 mindset",
      headline: "Not just clothes.",
      accent: "A way of moving",
      description: "Modern silhouettes. American streetwear influence. A style built for the city.",
      pillars: "Modern silhouettes\nAmerican streetwear influence\nA style built for the city",
    },
  },
  "home.latestDrop": {
    label: "Latest drop",
    page: "Home",
    fields: [text("eyebrow", "Eyebrow"), text("title", "Title"), text("subtitle", "Subtitle"), text("link", "Link to all clothes"), text("empty", "Text when no product is featured")],
    defaults: {
      eyebrow: "New season",
      title: "The latest drop",
      subtitle: "Selected for the King.",
      link: "View all clothes",
      empty: "The first drop is on its way.",
    },
  },
  "home.attitude": {
    label: "Editorial — attitude",
    page: "Home",
    fields: [
      text("eyebrow", "Eyebrow"),
      rows("title", "Title (one line per row)"),
      text("accent", "Accent word (red)"),
      area("description", "Description"),
      img("image", "Main image"),
      img("secondaryImage", "Small image (desktop)"),
      text("captionLeft", "Caption — left"),
      text("captionRight", "Caption — right"),
    ],
    defaults: {
      eyebrow: "Campaign / Studio session",
      title: "The\nKing 253",
      accent: "attitude.",
      description: "Street culture. Clean silhouettes. Strong identity.",
      image: IMAGES.portrait,
      secondaryImage: IMAGES.studio03,
      captionLeft: "Look 01",
      captionRight: "KING 253 Studio",
    },
  },
  "home.categories": {
    label: "Categories",
    page: "Home",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Title"),
      ...DEFAULT_CATEGORIES.map((c) => img(`image_${c.slug}`, `${c.name} image`, "Also used on the Clothes page category tiles.")),
    ],
    defaults: {
      eyebrow: "Categories",
      title: "Shop the style",
      ...Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [`image_${c.slug}`, CATEGORY_CROPS[c.slug].url])),
    },
  },
  "home.testimonials": {
    label: "Testimonials header",
    page: "Home",
    fields: [text("eyebrow", "Eyebrow"), text("title", "Title")],
    defaults: { eyebrow: "Word from the street", title: "The King's people" },
  },
  "home.story": {
    label: "Story preview",
    page: "Home",
    fields: [text("eyebrow", "Eyebrow"), rows("title", "Title (one line per row)"), area("description", "Description"), text("button", "Button"), img("image", "Image")],
    defaults: {
      eyebrow: "The story",
      title: "Who is\nKing?",
      description: "Discover the atmosphere, identity and vision behind KING 253.",
      button: "Meet KING 253",
      image: IMAGES.studio04,
    },
  },
  "home.location": {
    label: "Shops preview",
    page: "Home",
    fields: [
      text("eyebrow", "Eyebrow"),
      rows("title", "Title (one line per row)"),
      area("description", "Description"),
      text("button", "Button"),
      img("image", "Background image"),
    ],
    defaults: {
      eyebrow: "The shops",
      title: "Find\nthe King.",
      description: "Step into the KING 253 world and experience the collection in person.",
      button: "Find your closest shop",
      image: IMAGES.studio05,
    },
  },
  "home.finalCta": {
    label: "Final call to action",
    page: "Home",
    fields: [rows("lines", "Headline (one line per row)"), text("button", "Button"), img("background", "Background image")],
    defaults: { lines: "Your style.\nYour city.\nYour King.", button: "Shop KING 253", background: IMAGES.homeBackground },
  },

  /* --------------------------------------------------------- Who Is King */
  "who.hero": {
    label: "Page header",
    page: "Who Is King",
    fields: [text("eyebrow", "Eyebrow"), text("title", "Title"), text("subtitle", "Subtitle"), img("image", "Background image")],
    defaults: { eyebrow: "The story", title: "Who is King?", subtitle: "More than a store. A streetwear identity.", image: IMAGES.portrait },
  },
  "who.origin": {
    label: "01 — The origin",
    page: "Who Is King",
    fields: [
      text("title", "Title"),
      text("accent", "Title — second line"),
      area("body", "Origin story", "Separate paragraphs with an empty line. Leave empty to show the 'story coming soon' marker."),
      img("image", "Image"),
    ],
    defaults: { title: "Every crown has", accent: "a beginning.", body: "", image: IMAGES.studio02 },
  },
  "who.culture": {
    label: "02 — The culture",
    page: "Who Is King",
    fields: [rows("words", "Big words (3 lines)"), area("body", "Text"), img("image", "Image")],
    defaults: {
      words: "Street\nculture\nIdentity",
      body: "Brick walls. Red light. Raw textures. The culture lives in the details — and in the people who wear it.",
      image: IMAGES.studio05,
    },
  },
  "who.style": {
    label: "03 — The style",
    page: "Who Is King",
    fields: [
      rows("title", "Title (one line per row)"),
      area("body", "Text"),
      img("look1", "Look 1 image"),
      text("look1Label", "Look 1 caption"),
      img("look2", "Look 2 image"),
      text("look2Label", "Look 2 caption"),
      img("look3", "Look 3 image"),
      text("look3Label", "Look 3 caption"),
    ],
    defaults: {
      title: "The uniform\nof the city.",
      body: "Clean silhouettes, heavyweight layers, washed denim and cargo. Built to be worn, not posed in.",
      look1: IMAGES.portrait,
      look1Label: "Look 01",
      look2: IMAGES.studio03,
      look2Label: "Look 02",
      look3: IMAGES.studio04,
      look3Label: "Look 03",
    },
  },
  "who.experience": {
    label: "04 — The experience",
    page: "Who Is King",
    fields: [
      text("title", "Title"),
      text("accent", "Title — red line"),
      area("body", "Text"),
      text("primaryCta", "Primary button"),
      text("secondaryCta", "Secondary button"),
      img("image", "Background image"),
    ],
    defaults: {
      title: "Step into",
      accent: "the studio.",
      body: "Black brick, red light and the full collection — experienced in person.",
      primaryCta: "Find the store",
      secondaryCta: "Shop the collection",
      image: IMAGES.studio03,
    },
  },

  /* ------------------------------------------------------------ Location */
  "location.hero": {
    label: "Page header",
    page: "Location",
    fields: [text("eyebrow", "Eyebrow"), text("title", "Title"), text("subtitle", "Subtitle"), img("image", "Background image")],
    defaults: { eyebrow: "The shops", title: "Find the King.", subtitle: "Step into the world of KING 253.", image: IMAGES.studio03 },
  },
  "location.body": {
    label: "Shops & delivery text",
    page: "Location",
    help: "Shop addresses, hours and phones are managed in Admin → Locations.",
    fields: [
      text("findButton", "“Closest shop” button"),
      area("delivery", "Delivery information (under the shops)"),
      text("emptyTitle", "Label when no shop is listed"),
      area("emptyText", "Text when no shop is listed"),
      text("callLabel", "Phone label"),
    ],
    defaults: {
      findButton: "Find the closest shop",
      delivery: "Can't make it to a shop? We deliver everywhere in Algeria — cash on delivery.",
      emptyTitle: "Shop addresses to be announced",
      emptyText: "We deliver everywhere in Algeria while our shop details are being finalised — order online, pay cash on delivery.",
      callLabel: "Call us",
    },
  },

  /* ------------------------------------------------------------- Clothes */
  "clothes.hero": {
    label: "Collection header",
    page: "Clothes",
    fields: [text("eyebrow", "Eyebrow"), rows("title", "Title (one line per row)"), text("subtitle", "Subtitle"), img("background", "Background texture")],
    defaults: {
      eyebrow: "[ Series: Studio ]   [ KING 253 collection ]",
      title: "The\ncollection",
      subtitle: "Streetwear for the modern King.",
      background: IMAGES.clothesBackground,
    },
  },
  "clothes.look": {
    label: "Assemble your look",
    page: "Clothes",
    fields: [
      rows("products", "Product slugs (one per line, 2–4)", "Only published products are shown."),
      text("eyebrow", "Eyebrow"),
      rows("title", "Title (one line per row)"),
      text("note", "Line under the title"),
      text("hint", "Hint"),
      img("background", "Background image"),
    ],
    defaults: {
      products: "look-04-work-jacket\nlook-04-tee\nlook-05-cargo-denim\nlook-05-beanie",
      eyebrow: "Complete look",
      title: "Assemble\nyour look.",
      note: "Four pieces. One look. As worn in the studio.",
      hint: "Pick a size for each piece to add it to your bag.",
      background: IMAGES.studio05,
    },
  },
  "clothes.basics": {
    label: "Built on the basics",
    page: "Clothes",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Title"),
      area("body", "Text"),
      text("link", "Link text"),
      img("image", "Image"),
      rows("features", "Features — one per line: Title | text (3 lines)"),
    ],
    defaults: {
      eyebrow: "The mindset",
      title: "Built on the basics.",
      body: "Pieces that work together. Style lives in the details.",
      link: "Discover KING 253",
      image: IMAGES.studio03,
      features: "Visit the studio | See the collection in person.\nSave favourites | Heart any piece to keep it close.\nQuick view | Every piece, up close, in one click.",
    },
  },
  "clothes.join": {
    label: "Join band",
    page: "Clothes",
    fields: [text("line1", "Line 1"), text("line2", "Line 2"), text("button", "Button")],
    defaults: { line1: "Your style. Your city.", line2: "Welcome to KING 253.", button: "Join the club" },
  },
} satisfies Record<string, Section & { help?: string }>

export type ContentKey = keyof typeof CONTENT_SECTIONS
export type ContentOf<K extends ContentKey> = (typeof CONTENT_SECTIONS)[K]["defaults"]

export async function getContent<K extends ContentKey>(db: DbOrTx, key: K): Promise<ContentOf<K>> {
  const defaults = CONTENT_SECTIONS[key].defaults as Record<string, string>
  const [row] = await db.select().from(contentBlocks).where(eq(contentBlocks.key, key))
  const stored = (row?.data ?? {}) as Record<string, unknown>
  const merged: Record<string, string> = { ...defaults }
  for (const field of Object.keys(defaults)) {
    const value = stored[field]
    if (typeof value === "string" && value.trim() !== "") merged[field] = value
  }
  // The origin story is intentionally allowed to be empty.
  if (key === "who.origin" && typeof stored.body === "string") merged.body = stored.body
  return merged as ContentOf<K>
}

export async function saveContent(db: DbOrTx, key: ContentKey, data: Record<string, string>) {
  const allowed = new Set(CONTENT_SECTIONS[key].fields.map((f) => f.name))
  const clean = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.has(k)).map(([k, v]) => [k, v.slice(0, 5000)]))
  await db
    .insert(contentBlocks)
    .values({ key, data: clean })
    .onConflictDoUpdate({ target: contentBlocks.key, set: { data: clean, updatedAt: new Date() } })
}

export const lines = (value: string) =>
  value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

/** Category photo: the tuned default crop, or an admin upload shown centred. */
export function categoryCrop(content: ContentOf<"home.categories">, slug: string) {
  const fallback = CATEGORY_CROPS[slug] ?? CATEGORY_CROPS.jackets
  const url = (content as Record<string, string>)[`image_${slug}`]
  return !url || url === fallback.url ? fallback : { url, focusX: 50, focusY: 50, zoom: 1 }
}

/** "Title | text" rows. */
export const pairs = (value: string) =>
  lines(value).map((row) => {
    const [title, ...rest] = row.split("|")
    return { title: title.trim(), text: rest.join("|").trim() }
  })

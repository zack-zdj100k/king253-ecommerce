import { IMAGES } from "@/lib/site"

/**
 * Editorial category imagery (campaign crops) for category tiles and the
 * "Shop the style" showcase. Category names and the catalog itself live in
 * the database.
 */
export const CATEGORY_CROPS: Record<string, { url: string; focusX: number; focusY: number; zoom: number }> = {
  "t-shirts": { url: IMAGES.studio02, focusX: 50, focusY: 42, zoom: 1.9 },
  hoodies: { url: IMAGES.portrait, focusX: 55, focusY: 46, zoom: 1.35 },
  jackets: { url: IMAGES.studio03, focusX: 67, focusY: 45, zoom: 1.2 },
  pants: { url: IMAGES.portrait, focusX: 50, focusY: 74, zoom: 1.45 },
  denim: { url: IMAGES.studio05, focusX: 64, focusY: 70, zoom: 1.3 },
  accessories: { url: IMAGES.studio04, focusX: 64, focusY: 20, zoom: 2.2 },
}

/** Fallback category list for static navigation when the database is unavailable. */
export const DEFAULT_CATEGORIES = [
  { slug: "t-shirts", name: "T-Shirts" },
  { slug: "hoodies", name: "Hoodies" },
  { slug: "jackets", name: "Jackets" },
  { slug: "pants", name: "Pants" },
  { slug: "denim", name: "Denim" },
  { slug: "accessories", name: "Accessories" },
]

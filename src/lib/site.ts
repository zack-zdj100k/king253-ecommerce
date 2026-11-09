/** `key` = translation key in messages/*.json → nav.* */
export const NAV_LINKS = [
  { href: "/", key: "home" },
  { href: "/clothes", key: "clothes" },
  { href: "/who-is-king", key: "whoIsKing" },
  { href: "/location", key: "location" },
] as const

/** Works with or without the /ar /fr /en prefix in the browser URL. */
export function isActivePath(pathname: string, href: string) {
  const path = pathname.replace(/^\/(ar|fr|en)(?=\/|$)/, "") || "/"
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`)
}

export const IMAGES = {
  homeBackground: "/images/backgrounds/home-background.jpg",
  clothesBackground: "/images/backgrounds/clothes-background.jpg",
  portrait: "/images/hero/1.png",
  studio02: "/images/hero/2.jpg",
  studio03: "/images/hero/3.jpg",
  studio04: "/images/hero/4.jpg",
  studio05: "/images/hero/5.jpg",
} as const

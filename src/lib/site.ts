export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/clothes", label: "Clothes" },
  { href: "/who-is-king", label: "Who Is King" },
  { href: "/location", label: "Location" },
] as const

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
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

/** Common garment colours for the admin swatch picker. */
export const GARMENT_COLOURS: { name: string; hex: string }[] = [
  { name: "Black", hex: "#111111" },
  { name: "Washed black", hex: "#2b2b2b" },
  { name: "Charcoal", hex: "#3f4042" },
  { name: "Grey", hex: "#7d7d7b" },
  { name: "Heather grey", hex: "#a3a3a0" },
  { name: "White", hex: "#f5f5f2" },
  { name: "Off-white", hex: "#e8e4da" },
  { name: "Cream", hex: "#efe6d2" },
  { name: "Beige", hex: "#d8c7a6" },
  { name: "Sand", hex: "#c2b280" },
  { name: "Khaki", hex: "#a8996a" },
  { name: "Tan", hex: "#8a6a4c" },
  { name: "Brown", hex: "#5c3d2e" },
  { name: "Olive", hex: "#6b6448" },
  { name: "Army green", hex: "#4b5320" },
  { name: "Forest green", hex: "#1f3d2b" },
  { name: "Mint", hex: "#a8d5ba" },
  { name: "Navy", hex: "#1c2541" },
  { name: "Blue", hex: "#1f4fa8" },
  { name: "Light blue", hex: "#9cc3e6" },
  { name: "Denim", hex: "#5a626b" },
  { name: "Burgundy", hex: "#6d1a24" },
  { name: "Red", hex: "#b3121b" },
  { name: "Pink", hex: "#e8a0b4" },
  { name: "Purple", hex: "#5b2a86" },
  { name: "Lavender", hex: "#b9a6d8" },
  { name: "Yellow", hex: "#e6c229" },
  { name: "Orange", hex: "#e0752d" },
]

/** "blue", "Blue " or "BLUE" → the preset hex, so typing a name fills the swatch. */
export function hexForName(name: string): string | null {
  const key = name.trim().toLowerCase()
  if (!key) return null
  return GARMENT_COLOURS.find((c) => c.name.toLowerCase() === key)?.hex ?? null
}

export const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v)

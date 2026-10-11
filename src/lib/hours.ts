/** "Sat–Thu | 10:00–20:00" lines → rows for display. */
export function parseHours(text: string | null | undefined) {
  if (!text) return []
  return text
    .split("\n")
    .map((line) => line.split("|").map((x) => x.trim()))
    .filter((parts) => parts[0])
    .map(([days, time]) => ({ days, time: time ?? "" }))
}

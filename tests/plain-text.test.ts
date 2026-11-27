import { describe, expect, it } from "vitest"

import { cleanMarkdown } from "@/lib/plain-text"

describe("cleanMarkdown", () => {
  it("cleans the pasted Notion/ChatGPT text seen on the live product page", () => {
    const raw = [
      "\\## Balenciaga Paris 10 Graphic Hoodie – Black\\",
      "\\",
      "Make a statement with the hoodie.\\",
      "\\",
      "oversized \\*\\*PARIS 10\\*\\* graphic.\\",
      "\\",
      "\\*\\*Details:\\*\\*\\",
      "\\- Color: Black\\",
      "\\- Design: Paris 10 football-inspired graphic\\",
    ].join("\n")
    const out = cleanMarkdown(raw)
    expect(out).toBe(
      ["Balenciaga Paris 10 Graphic Hoodie – Black", "", "Make a statement with the hoodie.", "", "oversized PARIS 10 graphic.", "", "Details:", "• Color: Black", "• Design: Paris 10 football-inspired graphic"].join("\n")
    )
    expect(out).not.toMatch(/\\|\*\*|##/)
  })

  it("leaves ordinary text alone", () => {
    expect(cleanMarkdown("Veste chaude.\nLavage 30°, 5*3 cm")).toBe("Veste chaude.\nLavage 30°, 5*3 cm")
    expect(cleanMarkdown("قميص قطني\n\nغسيل بارد")).toBe("قميص قطني\n\nغسيل بارد")
    expect(cleanMarkdown(null)).toBe("")
  })

  it("real Markdown too: headings, bold, bullets", () => {
    expect(cleanMarkdown("## Fit\n**Relaxed** cut\n- Hood\n* Pocket")).toBe("Fit\nRelaxed cut\n• Hood\n• Pocket")
  })
})

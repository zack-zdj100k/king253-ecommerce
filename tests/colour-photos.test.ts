import { describe, expect, it } from "vitest"

import { imagesForColour } from "@/components/shop/variant-picker"

const img = (url: string, color: string | null) => ({ url, focusX: 50, focusY: 50, zoom: 1, alt: null, color })

describe("Product page photos per colour", () => {
  const images = [img("/main.jpg", null), img("/blue-1.jpg", "blue"), img("/blue-2.jpg", "blue"), img("/black-1.jpg", "black")]

  it("shows only the chosen colour's photos (the main photo stays on the card)", () => {
    expect(imagesForColour(images, "blue").map((i) => i.url)).toEqual(["/blue-1.jpg", "/blue-2.jpg"])
    expect(imagesForColour(images, "black").map((i) => i.url)).toEqual(["/black-1.jpg"])
  })

  it("falls back to the general photos while a colour has none", () => {
    expect(imagesForColour(images, "red").map((i) => i.url)).toEqual(["/main.jpg"])
  })
})

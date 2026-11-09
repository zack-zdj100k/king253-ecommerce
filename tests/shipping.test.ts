import { beforeEach, describe, expect, it } from "vitest"

import { parseCsv, parsePrice, readDeliveryCsv } from "@/lib/delivery-csv.mjs"
import { importDeliveryCsv, listRates, quoteShops, saveDesk, suggestDesk } from "@/server/shipping"
import { resetDb, testDb, testShop } from "./support/db"

const actor = { userId: null, label: "Test" }

describe("Delivery CSV", () => {
  it("reads commas, semicolons, quotes and DA amounts", () => {
    expect(parseCsv('a;b\n"x;y";2\r\n')).toEqual([["a", "b"], ["x;y", "2"]])
    expect([parsePrice("1 200"), parsePrice("1.200,00"), parsePrice("850 DA"), parsePrice(""), parsePrice("abc")]).toEqual([1200, 1200, 850, null, NaN])
  })

  it("matches shops by short code and wilayas by code, French or Arabic name; reports every bad line", () => {
    const ref = { shops: [{ id: 1, slug: "annaba" }], wilayas: [{ code: 16, fr: "Alger", ar: "الجزائر" }, { code: 25, fr: "Constantine", ar: "قسنطينة" }] }
    const ok = readDeliveryCsv("rates", "shop,wilaya,home_price,desk_price\nannaba,16 - Alger,800,500\nAnnaba,قسنطينة,400,\n", ref)
    expect(ok.errors).toEqual([])
    expect(ok.rows).toEqual([
      { storeId: 1, wilayaCode: 16, homePrice: 800, deskPrice: 500 },
      { storeId: 1, wilayaCode: 25, homePrice: 400, deskPrice: null },
    ])
    const bad = readDeliveryCsv("rates", "shop,wilaya,home_price,desk_price\nsetif,16,1,1\nannaba,Nowhere,1,1\nannaba,16,cheap,1\n", ref)
    expect(bad.errors).toHaveLength(3)
    expect(readDeliveryCsv("desks", "shop,wilaya\nannaba,16", ref).errors[0]).toMatch(/Missing column/)
  })
})

describe("Delivery prices per shop", () => {
  beforeEach(async () => {
    await resetDb()
  })

  it("imports all-or-nothing, then quotes each shop cheapest first and suggests the desk in the customer's commune", async () => {
    const a = await testShop("annaba")
    const c = await testShop("constantine")
    await expect(importDeliveryCsv(testDb, "rates", "shop,wilaya,home_price,desk_price\nannaba,16,800,500\nnope,16,1,1", actor)).rejects.toThrow(
      /Nothing imported/
    )
    expect((await listRates(testDb, a.id)).find((r) => r.code === 16)?.homePrice).toBeNull()

    await importDeliveryCsv(testDb, "rates", "shop,wilaya,home_price,desk_price\nannaba,16,800,500\nconstantine,16,700,450", actor)
    await importDeliveryCsv(
      testDb,
      "desks",
      "shop;wilaya;commune;name;address;desk_price\nannaba;16;Alger Centre;Desk A1;1 rue;\nannaba;16;Bab Ezzouar;Desk A2;2 rue;300\nconstantine;16;Hydra;Desk C1;3 rue;",
      actor
    )

    const shops = [
      { id: a.id, name: a.name },
      { id: c.id, name: c.name },
    ]
    const home = await quoteShops(testDb, { shops, wilayaCode: 16, wilayaName: "Alger", commune: "Bab Ezzouar", type: "home" })
    expect(home.map((q) => [q.storeId, q.price])).toEqual([
      [c.id, 700],
      [a.id, 800],
    ])

    const desk = await quoteShops(testDb, { shops, wilayaCode: 16, wilayaName: "Alger", commune: "Bab Ezzouar", type: "desk" })
    // Annaba's suggested desk is in Bab Ezzouar at its own 300 DA → cheapest.
    expect(desk[0]).toMatchObject({ storeId: a.id, price: 300 })
    expect(desk[0].desks.find((d) => d.id === desk[0].suggestedDeskId)?.name).toBe("Desk A2")
    expect(desk[1]).toMatchObject({ storeId: c.id, price: 450 })

    // No desk in a wilaya → that shop is not available for desk delivery there.
    const none = await quoteShops(testDb, { shops, wilayaCode: 25, wilayaName: "Constantine", type: "desk" })
    expect(none.every((q) => !q.available)).toBe(true)
  })

  it("refuses two desks with the same name in one wilaya", async () => {
    const a = await testShop("annaba")
    await saveDesk(testDb, a.id, null, { wilayaCode: 16, commune: "Hydra", name: "Desk" }, actor)
    await expect(saveDesk(testDb, a.id, null, { wilayaCode: 16, commune: "Kouba", name: "Desk" }, actor)).rejects.toThrow(/already has a desk/)
  })

  it("suggests the wilaya's main town when the commune has no desk", () => {
    const desks = [{ commune: "El Khroub" }, { commune: "Constantine" }]
    expect(suggestDesk(desks, "Ain Smara", "Constantine")).toEqual({ commune: "Constantine" })
    expect(suggestDesk(desks, "el khroub", "Constantine")).toEqual({ commune: "El Khroub" })
  })
})

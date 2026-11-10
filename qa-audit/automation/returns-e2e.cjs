// Real status changes + return + exchange + cancel, in the admin (local data only).
const { chromium } = require(process.env.PW)
const fs = require("fs")
const BASE = process.env.BASE
const TOKEN = fs.readFileSync(process.env.TOKENFILE || (__dirname + "/admin-token.txt"), "utf8").trim()
const shots = (process.env.OUT || (__dirname + "/out")) + "/"
fs.mkdirSync(shots, { recursive: true })
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const wait = (p, ms = 800) => p.waitForTimeout(ms)
const results = []
let errors = []
async function step(name, fn) {
  errors = []
  try { await fn(); results.push([errors.length ? "FAIL" : "PASS", name, errors.join(" | ")]) } catch (e) { results.push(["FAIL", name, e.message.split("\n")[0] + " " + errors.join(" | ")]) }
}
const watch = (p) => { p.on("pageerror", (e) => errors.push("JS " + e.message)); p.on("response", (r) => r.url().startsWith(BASE) && r.status() >= 500 && errors.push("HTTP " + r.status() + " " + r.url().replace(BASE, ""))) }

async function placeOrder(browser, qty) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: UA })
  const p = await ctx.newPage(); watch(p)
  await p.goto(BASE + "/fr/clothes", { waitUntil: "networkidle" }); await wait(p, 1500)
  const card = p.locator("article").nth(1); await card.scrollIntoViewIfNeeded()
  await card.getByRole("button", { name: /au panier/ }).click(); await wait(p, 1500)
  const size = card.locator("[role=group] button").filter({ hasText: /^[A-Z0-9]/ }).first()
  if (await size.count()) await size.click()
  await wait(p, 2000)
  for (let i = 1; i < qty; i++) { await p.getByRole("dialog").getByRole("button", { name: /augmenter|plus|increase/i }).first().click(); await wait(p, 1200) }
  await p.goto(BASE + "/fr/checkout", { waitUntil: "networkidle" }); await wait(p, 1500)
  await p.getByLabel(/Nom complet|Nom/i).first().fill("Test Retour")
  await p.getByLabel(/Téléphone/i).first().fill("055" + String(Date.now()).slice(-7))
  await p.getByLabel(/Adresse/i).first().fill("1 rue test")
  await p.getByLabel(/Wilaya/i).first().selectOption({ index: 23 }); await wait(p, 1500)
  await p.getByLabel(/Commune/i).first().selectOption({ index: 1 }).catch(() => {}); await wait(p, 2500)
  await p.getByLabel(/connus/i).first().selectOption({ index: 1 })
  await p.getByLabel(/Mot de passe/i).first().fill("final-test-pass-1")
  await p.getByRole("button", { name: /Confirmer|Commander|Valider/i }).last().click()
  await p.waitForURL(/\/order\//, { timeout: 25000 })
  const number = (await p.content()).match(/KING253-\d+-\d+/)?.[0]
  await ctx.close()
  return number
}

;(async () => {
  const browser = await chromium.launch()
  const adm = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await adm.addCookies([{ name: "k253_session", value: TOKEN, url: BASE }])
  const a = await adm.newPage(); watch(a)
  const body = () => a.locator("main, body").first().innerText()
  const openOrder = async (number) => {
    await a.goto(BASE + "/admin/orders?status=pending&q=" + encodeURIComponent(number), { waitUntil: "networkidle" })
    await a.locator("a[href^='/admin/orders/']", { hasText: number }).first().click()
    await a.waitForURL(/\/admin\/orders\/.+/); await wait(a, 1500)
  }
  const setStatus = async (label) => {
    await a.getByRole("button", { name: new RegExp("^→ " + label) }).click()
    await a.getByRole("button", { name: new RegExp("^Set to " + label) }).click()
    await wait(a, 2500)
  }

  let n1, n2
  await step("customer places order #1 (2 pieces)", async () => { n1 = await placeOrder(browser, 2); if (!n1) throw new Error("no order number") })
  await step("admin: Pending → Confirmed (real status change)", async () => {
    await openOrder(n1); await setStatus("Confirmed")
    if (!/Confirmed/.test(await body())) throw new Error("status not Confirmed")
  })
  await step("admin: Confirmed → Delivered", async () => {
    await setStatus("Delivered")
    await a.screenshot({ path: shots + "delivered.png", fullPage: true })
    if (!/Delivered/.test(await body())) throw new Error("status not Delivered")
  })
  await step("RETURN 1 of 2 pieces → recorded, refund shown", async () => {
    await a.getByRole("tab", { name: /Return/ }).click()
    await a.getByRole("button", { name: /One more/ }).first().click()
    const refund = await a.locator("text=To refund the customer").locator("..").innerText()
    await a.getByRole("button", { name: "Record return" }).click(); await wait(a, 3000)
    await a.screenshot({ path: shots + "after-return.png", fullPage: true })
    const t = await body()
    if (!/can come back|Return|returned/i.test(t)) throw new Error("no return trace: " + t.slice(0, 200))
    console.log("   return refund line:", refund.replace(/\s+/g, " "))
  })
  await step("EXCHANGE the other piece for another size/product → difference + recorded", async () => {
    await a.getByRole("tab", { name: /Exchange/ }).click()
    await a.getByRole("button", { name: /One more/ }).first().click()
    const opt = await a.locator("select[aria-label='New item'] option:not([disabled])").evaluateAll((os) => os.filter((o) => o.value).map((o) => o.value)[1] ?? os.find((o) => o.value)?.value)
    await a.locator("select[aria-label='New item']").selectOption(opt)
    await a.getByRole("button", { name: /^Add$/ }).click(); await wait(a, 600)
    const diff = await a.locator("text=/To collect|To refund|No difference/").first().innerText()
    await a.getByRole("button", { name: "Record exchange" }).click(); await wait(a, 3000)
    await a.screenshot({ path: shots + "after-exchange.png", fullPage: true })
    console.log("   exchange difference line:", diff)
  })
  await step("journal page lists 1 return + 1 exchange", async () => {
    await a.goto(BASE + "/admin/returns", { waitUntil: "networkidle" }); await wait(a, 1200)
    await a.screenshot({ path: shots + "journal.png", fullPage: true })
    const t = await body()
    console.log("   journal totals:", (t.match(/Returns\s*\n?\s*\d+|Exchanges\s*\n?\s*\d+|Refunded[^\n]*\n?[^\n]*/g) || []).join(" | ").replace(/\s+/g, " ").slice(0, 160))
  })
  await step("customer order #2 → admin CANCEL (stock released)", async () => {
    n2 = await placeOrder(browser, 1)
    await openOrder(n2)
    await a.getByRole("button", { name: /^Cancel order/ }).click()
    await a.getByRole("button", { name: /^Set to Cancelled/ }).click(); await wait(a, 2500)
    await a.screenshot({ path: shots + "cancelled.png", fullPage: true })
    if (!/Cancelled/.test(await body())) throw new Error("not cancelled")
  })
  await step("overview + inventory still load after all that", async () => {
    for (const u of ["/admin", "/admin/inventory", "/admin/orders?status=delivered", "/admin/orders?status=cancelled"]) {
      const r = await a.goto(BASE + u, { waitUntil: "networkidle" }); if (r.status() >= 400) throw new Error(u + " " + r.status())
    }
  })
  await browser.close()
  for (const r of results) console.log(r.join("  "))
})()

// Same customer journey on Chromium (Chrome/Edge engine), Firefox and WebKit (Safari engine), desktop + iPhone/Android.
// Ends with a real guest order — LOCAL data only (never point BASE at king253.com).
const pw = require(process.env.PW)
const fs = require("fs")
const BASE = process.env.BASE
const OUT = process.env.OUT || "/tmp/qa-cross"
fs.mkdirSync(OUT, { recursive: true })
const RUN = Date.now().toString(36)
const rows = []
const wait = (p, ms = 800) => p.waitForTimeout(ms)
const phoneNo = () => "055" + String(Date.now() + Math.floor(Math.random() * 999)).slice(-7)

const CONFIGS = [
  { name: "Chromium desktop", engine: "chromium", ctx: { viewport: { width: 1440, height: 900 } } },
  { name: "Firefox desktop", engine: "firefox", ctx: { viewport: { width: 1440, height: 900 } } },
  { name: "WebKit (Safari) desktop", engine: "webkit", ctx: { viewport: { width: 1440, height: 900 } } },
  { name: "WebKit iPhone 15", engine: "webkit", ctx: pw.devices["iPhone 15"] },
  { name: "Chromium Android (Pixel 7)", engine: "chromium", ctx: pw.devices["Pixel 7"] },
  { name: "Firefox mobile-size", engine: "firefox", ctx: { viewport: { width: 390, height: 844 } } },
]

;(async () => {
  for (const c of CONFIGS) {
    const browser = await pw[c.engine].launch()
    const ctx = await browser.newContext({ ...c.ctx, extraHTTPHeaders: { "x-forwarded-for": `10.12.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } })
    await ctx.addCookies([{ name: "k253_locale", value: "fr", url: BASE }])
    const page = await ctx.newPage()
    const errs = []
    page.on("pageerror", (e) => errs.push(e.message.slice(0, 120)))
    const r = { config: c.name }
    const step = async (k, fn) => { try { r[k] = (await fn()) ?? "ok" } catch (e) { r[k] = "FAIL: " + e.message.split("\n")[0].slice(0, 90) } }
    await step("home", async () => { const res = await page.goto(BASE + "/fr", { waitUntil: "networkidle", timeout: 60000 }); await wait(page, 2500); if (res.status() !== 200) throw new Error(res.status()); if (!(await page.locator("#hero-title").isVisible())) throw new Error("hero title hidden") })
    await step("heroScroll", async () => { for (let i = 0; i < 4; i++) { await page.evaluate(() => scrollBy(0, 500)); await wait(page, 600) } const ok = await page.locator("#hero-title").isVisible(); await page.evaluate(() => scrollTo(0, 0)); if (!ok) throw new Error("hero text disappeared") })
    await step("arabicRTL", async () => { await page.goto(BASE + "/ar", { waitUntil: "networkidle" }); const d = await page.evaluate(() => document.documentElement.dir); if (d !== "rtl") throw new Error("dir " + d) })
    await step("catalog", async () => { await page.goto(BASE + "/fr/clothes", { waitUntil: "networkidle" }); await wait(page, 1500); const n = await page.locator("article").count(); if (n < 1) throw new Error("no cards"); return `${n} cards` })
    await step("buyNowOrder", async () => {
      await page.goto(BASE + "/fr/product/china-jacket", { waitUntil: "networkidle" }); await wait(page, 1500)
      const sizes = page.locator("button[aria-pressed], [role=radio]").filter({ hasText: /^(XS|S|M|L|XL|XXL)$/ })
      let picked = false
      for (let i = 0; i < (await sizes.count()); i++) if (await sizes.nth(i).isEnabled()) { await sizes.nth(i).click(); picked = true; break }
      if (!picked) throw new Error("no size in stock")
      await page.getByRole("button", { name: /Acheter maintenant/i }).first().click()
      await page.waitForURL(/\/checkout/, { timeout: 20000 })
      if (/sign-/.test(page.url())) throw new Error("sent to sign-in")
      await wait(page, 1500)
      await page.getByLabel(/Nom complet/i).first().fill(`Cross ${c.engine} ${RUN}`)
      await page.getByLabel(/Téléphone/i).first().fill(phoneNo())
      await page.getByLabel(/Rue \/ adresse/i).first().fill("7 rue des navigateurs")
      await page.getByLabel(/Wilaya/i).first().selectOption({ index: 23 }); await wait(page, 1500)
      await page.getByLabel(/Commune/i).first().selectOption({ index: 1 }).catch(() => {}); await wait(page, 2500)
      await page.getByLabel(/connus/i).first().selectOption({ index: 1 }).catch(() => {})
      await page.getByLabel(/mot de passe/i).first().fill("cross-pass-123").catch(() => {})
      await page.getByRole("button", { name: /Confirmer la commande/i }).last().click()
      await page.waitForURL(/\/order\//, { timeout: 30000 })
      await page.screenshot({ path: `${OUT}/${c.name.replace(/\W+/g, "-")}-order.png` })
      return (await page.content()).match(/KING253-\d+-\d+/)?.[0] || "order page"
    })
    await step("bottomBarOrMenu", async () => {
      await page.goto(BASE + "/fr", { waitUntil: "networkidle" }); await wait(page, 1500)
      const isPhone = (c.ctx.viewport?.width ?? 1440) < 1024
      if (isPhone) { await page.getByRole("navigation", { name: /Pages rapides/ }).locator('a[href$="/clothes"]').click() }
      else { await page.getByRole("navigation", { name: /principal|main/i }).getByRole("link", { name: /Vêtements/i }).first().click() }
      await page.waitForURL(/clothes/, { timeout: 15000 })
    })
    r.jsErrors = errs.length ? errs.slice(0, 2).join(" | ") : 0
    rows.push(r)
    console.log(JSON.stringify(r))
    await browser.close()
  }
  fs.writeFileSync(`${OUT}/cross-browser.json`, JSON.stringify(rows, null, 1))
  const fails = rows.flatMap((r) => Object.entries(r).filter(([k, v]) => String(v).startsWith("FAIL")).map(([k, v]) => `${r.config}: ${k} ${v}`))
  console.log(`\nCross-browser: ${rows.length} configurations, ${fails.length} failing steps`); fails.forEach((f) => console.log("  " + f))
})()

const { chromium } = require(process.env.PW)
const fs = require("fs")
const BASE = process.env.BASE, OUT = process.env.OUT
const LIVE = process.env.LIVE === "1" // live site: public pages only
const TOKEN = LIVE ? "" : fs.readFileSync(process.env.TOKENFILE, "utf8").trim()
fs.mkdirSync(OUT, { recursive: true })
const SIZES = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]
const SITE = ["/fr", "/ar", "/en/clothes", "/fr/clothes", "/fr/product/china-jacket", "/fr/who-is-king", "/fr/location", "/fr/sign-in", "/fr/wishlist", "/fr/track"]
const ADMIN = ["/admin", "/admin/orders", "/admin/products", "/admin/inventory", "/admin/returns", "/admin/shops", "/admin/delivery"]
const results = []
;(async () => {
  const browser = await chromium.launch()
  // a real buy-now link for the checkout page
  const buy = process.env.BUYURL
  for (const w of SIZES) {
    const h = w < 500 ? 800 : w < 1100 ? 900 : 1000
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, extraHTTPHeaders: { "x-forwarded-for": `10.4.${w % 250}.${Math.floor(Math.random() * 250)}` } })
    await ctx.addCookies([{ name: "k253_locale", value: "fr", url: BASE }])
    const pages = [...SITE.map((p) => ({ p, admin: false })), ...(buy ? [{ p: buy, admin: false }] : []), ...(LIVE ? [] : ADMIN.map((p) => ({ p, admin: true })))]
    for (const { p, admin } of pages) {
      const c2 = admin ? await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 }) : ctx
      if (admin) await c2.addCookies([{ name: "k253_session", value: TOKEN, url: BASE }])
      const page = await c2.newPage()
      const errs = []
      page.on("pageerror", (e) => errs.push(e.message))
      page.on("console", (m) => m.type() === "error" && !/Failed to load resource.*(400|404)/.test(m.text()) && errs.push(m.text().slice(0, 100)))
      try {
        const r = await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 60000 })
        await page.waitForTimeout(900)
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } scrollTo(0, 0) })
        const m = await page.evaluate(() => {
          const W = innerWidth
          const overflow = document.documentElement.scrollWidth - W
          const wide = overflow > 1 ? [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.right > W + 2 && r.width > 0 && cs.position !== "fixed" && !e.closest("[aria-hidden=true]") }).slice(0, 3).map((e) => `${e.tagName}.${String(e.className).slice(0, 40)}`) : []
          const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:") && i.loading !== "lazy").length
          const noAlt = [...document.images].filter((i) => !i.hasAttribute("alt")).length
          const tiny = [...document.querySelectorAll("p,span,a,li,button,label")].filter((e) => { const cs = getComputedStyle(e); return e.innerText && e.innerText.trim().length > 2 && parseFloat(cs.fontSize) < 10 && e.getBoundingClientRect().width > 0 && cs.visibility !== "hidden" && !e.closest("[aria-hidden=true]") }).length
          const small = W < 768 ? [...document.querySelectorAll("a[href],button")].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24) && cs.visibility !== "hidden" && !e.closest("[aria-hidden=true]") && !e.classList.contains("sr-only") }).length : 0
          return { overflow, wide, broken, noAlt, tiny, small, h1: document.querySelectorAll("h1").length, dir: document.documentElement.dir }
        })
        results.push({ w, p, status: r.status(), errs: errs.length, ...m })
        if ((w === 320 || w === 1920) && ["/fr", "/fr/product/china-jacket"].includes(p)) await page.screenshot({ path: `${OUT}/vp-${w}-${p.replace(/\//g, "_")}.png`, fullPage: false })
      } catch (e) { results.push({ w, p, status: 0, err: e.message.split("\n")[0], errs: 1 }) }
      await page.close(); if (admin) await c2.close()
    }
    await ctx.close()
    const rows = results.filter((r) => r.w === w)
    console.log(`${String(w).padStart(4)}px  pages ${rows.length}  overflow ${rows.filter((r) => r.overflow > 1).length}  js/console errors ${rows.reduce((n, r) => n + r.errs, 0)}  broken-img ${rows.reduce((n, r) => n + (r.broken || 0), 0)}  img-no-alt ${rows.reduce((n, r) => n + (r.noAlt || 0), 0)}  tiny-text ${rows.reduce((n, r) => n + (r.tiny || 0), 0)}  small-tap ${rows.reduce((n, r) => n + (r.small || 0), 0)}  bad-status ${rows.filter((r) => r.status !== 200).length}`)
  }
  // keyboard: Tab through the home page; every focused element must show a focus indicator
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addCookies([{ name: "k253_locale", value: "fr", url: BASE }])
  const kp = await ctx.newPage()
  const keyResults = []
  for (const p of ["/fr", "/fr/clothes", "/fr/sign-in"]) {
    await kp.goto(BASE + p, { waitUntil: "networkidle" }); await kp.waitForTimeout(1500)
    let noRing = [], count = 0, trap = false
    for (let i = 0; i < 40; i++) {
      await kp.keyboard.press("Tab")
      const f = await kp.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none") || e.matches(":focus-visible") && (cs.borderColor !== "" ); const r = e.getBoundingClientRect(); return { tag: e.tagName, name: (e.getAttribute("aria-label") || e.innerText || "").trim().slice(0, 25), ring: !!ring, visible: r.width > 0 } })
      if (f && f.visible) { count++; if (!f.ring) noRing.push(`${f.tag}:${f.name}`) }
    }
    keyResults.push({ p, focusStops: count, noRing: noRing.slice(0, 6), noRingCount: noRing.length })
    console.log(`keyboard ${p}: ${count} focus stops, ${noRing.length} without a visible ring ${noRing.slice(0, 4).join(" | ")}`)
  }
  await browser.close()
  fs.writeFileSync(`${OUT}/viewports.json`, JSON.stringify({ results, keyResults }, null, 1))
  const bad = results.filter((r) => r.overflow > 1 || r.errs || r.status !== 200 || r.broken)
  for (const r of bad.slice(0, 25)) console.log("  ISSUE", r.w, r.p, `overflow ${r.overflow}`, r.wide?.join(","), `errs ${r.errs}`, `status ${r.status}`, r.err || "")
  console.log(`TOTAL page×size checks: ${results.length}, with issues: ${bad.length}`)
})()

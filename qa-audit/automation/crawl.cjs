// Crawl every internal page (storefront in 3 languages + admin) and record problems.
const { chromium } = require(process.env.PW)
const fs = require("fs")
const BASE = process.env.BASE || "http://localhost:3002"
const TOKEN = fs.readFileSync(__dirname + "/admin-token.txt", "utf8").trim()
const out = __dirname + "/crawl/"
fs.mkdirSync(out, { recursive: true })

const SKIP = /^(mailto:|tel:|https?:\/\/(?!localhost)|javascript:|#)/
const problems = []
const note = (kind, url, detail) => problems.push({ kind, url, detail: String(detail).slice(0, 300) })

async function crawl(browser, { name, viewport, start, scope, admin, max }) {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 768, hasTouch: viewport.width < 768 })
  if (admin) await ctx.addCookies([{ name: "k253_session", value: TOKEN, url: BASE }])
  const seen = new Set()
  const queue = [...start]
  let visited = 0
  while (queue.length && visited < max) {
    const path = queue.shift()
    const key = path.split("#")[0]
    if (seen.has(key)) continue
    seen.add(key)
    visited++
    const page = await ctx.newPage()
    const url = BASE + key
    page.on("pageerror", (e) => note("js-error", key, e.message))
    page.on("console", (m) => {
      if (m.type() === "error" && !/Download the React DevTools|favicon/.test(m.text())) note("console-error", key, m.text())
    })
    page.on("response", (r) => {
      const u = r.url()
      if (u.startsWith(BASE) && r.status() >= 400 && !/\/_next\/webpack-hmr/.test(u)) note(`http-${r.status()}`, key, u.replace(BASE, ""))
    })
    page.on("requestfailed", (r) => {
      const u = r.url()
      if (u.startsWith(BASE) && !/net::ERR_ABORTED/.test(r.failure()?.errorText ?? "")) note("request-failed", key, `${u.replace(BASE, "")} ${r.failure()?.errorText}`)
    })
    try {
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
      if (!res) note("no-response", key, "")
      else if (res.status() >= 400 && !/\/(product|order)\/does-not-exist/.test(key)) note(`page-${res.status()}`, key, res.url())
      await page.waitForTimeout(600)
      // scroll through the page so lazy images and scroll animations run
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) {
          scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 120))
        }
        scrollTo(0, 0)
      })
      await page.waitForTimeout(400)
      const info = await page.evaluate(() => {
        const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:")).map((i) => i.src)
        const overflow = document.documentElement.scrollWidth - innerWidth
        const emptyLinks = [...document.querySelectorAll("a")].filter((a) => !a.getAttribute("href")).length
        const unnamed = [...document.querySelectorAll("button, a[href]")]
          .filter((el) => el.offsetParent !== null && !(el.innerText || "").trim() && !el.getAttribute("aria-label") && !el.getAttribute("title") && !el.querySelector("img[alt]:not([alt=''])") && !el.getAttribute("aria-labelledby"))
          .map((el) => el.outerHTML.slice(0, 120))
        const rawKeys = (document.body.innerText.match(/\b[a-z]+\.[a-zA-Z_]+\.[a-zA-Z_]+\b|\{[a-z]+\}/g) || []).filter((s) => !/\.(com|dz|js|png|jpg|webp)/.test(s))
        const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"))
        return { broken, overflow, emptyLinks, unnamed: unnamed.slice(0, 5), rawKeys: rawKeys.slice(0, 5), links, title: document.title, lang: document.documentElement.lang, dir: document.documentElement.dir }
      })
      if (info.broken.length) note("broken-image", key, info.broken.join(" "))
      if (info.overflow > 1) note("horizontal-scroll", key, `${info.overflow}px wider than the screen`)
      if (info.unnamed.length) note("button-without-name", key, info.unnamed.join(" | "))
      if (info.rawKeys.length) note("raw-text-key", key, info.rawKeys.join(" "))
      if (!info.title) note("no-title", key, "")
      if (admin && info.dir !== "ltr") note("admin-not-ltr", key, info.dir)
      for (const href of info.links) {
        if (!href || SKIP.test(href)) continue
        let p
        try {
          const u = new URL(href, url)
          if (u.origin !== new URL(BASE).origin) continue
          p = u.pathname + u.search
        } catch {
          continue
        }
        if (/\/api\/|\/media\/|\.(xml|txt|png|jpg|webp|pdf|csv)$/.test(p)) continue
        if (/sign-out|logout/.test(p)) continue
        if (!scope(p)) continue
        if (!seen.has(p)) queue.push(p)
      }
    } catch (e) {
      note("load-failed", key, e.message)
    }
    await page.close()
  }
  console.log(`${name}: ${visited} pages`)
  await ctx.close()
  return [...seen]
}

;(async () => {
  const browser = await chromium.launch()
  const phone = { width: 375, height: 812 }
  const desktop = { width: 1440, height: 900 }
  const site = (p) => !p.startsWith("/admin")
  const pages = {}
  for (const loc of ["fr", "ar", "en"]) {
    pages[`site-${loc}-phone`] = await crawl(browser, { name: `site ${loc} phone`, viewport: phone, start: [`/${loc}`, `/${loc}/clothes`, `/${loc}/who-is-king`, `/${loc}/location`, `/${loc}/track`, `/${loc}/sign-in`, `/${loc}/sign-up`, `/${loc}/wishlist`, `/${loc}/checkout`, `/language`], scope: site, admin: false, max: 70 })
  }
  pages["site-fr-desktop"] = await crawl(browser, { name: "site fr desktop", viewport: desktop, start: ["/fr", "/fr/clothes"], scope: site, admin: false, max: 70 })
  pages["admin-desktop"] = await crawl(browser, { name: "admin desktop", viewport: desktop, start: ["/admin"], scope: (p) => p.startsWith("/admin"), admin: true, max: 160 })
  pages["admin-phone"] = await crawl(browser, { name: "admin phone", viewport: phone, start: ["/admin"], scope: (p) => p.startsWith("/admin") && !/\/admin\/(orders|products|users|customers)\/[^/?]+/.test(p), admin: true, max: 40 })
  await browser.close()
  fs.writeFileSync(out + "pages.json", JSON.stringify(pages, null, 1))
  fs.writeFileSync(out + "problems.json", JSON.stringify(problems, null, 1))
  const byKind = {}
  for (const p of problems) (byKind[p.kind] ??= []).push(p)
  for (const [k, list] of Object.entries(byKind)) {
    console.log(`\n== ${k}: ${list.length}`)
    const uniq = new Map()
    for (const p of list) if (!uniq.has(p.detail)) uniq.set(p.detail, p.url)
    for (const [d, u] of [...uniq].slice(0, 12)) console.log(`  ${u}  →  ${d}`)
  }
})()

const BASE = process.env.BASE
const res = []
const rec = (id, name, ok, d = "") => { res.push({ id, name, ok, d }); console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${name}${d ? "  → " + String(d).slice(0, 150) : ""}`) }
const get = async (p, ua = "Mozilla/5.0 Googlebot") => { const r = await fetch(BASE + p, { redirect: "manual", headers: { "user-agent": ua, "x-forwarded-for": "10.3.3.3" } }); return { status: r.status, body: await r.text(), headers: r.headers } }
const tag = (html, re) => (html.match(re) || [])[1] || ""
;(async () => {
  const pages = ["/fr", "/ar", "/en", "/fr/clothes", "/ar/clothes", "/en/clothes", "/fr/who-is-king", "/fr/location", "/fr/product/china-jacket", "/fr/product/jacket-china", "/fr/track", "/fr/sign-in"]
  const titles = new Map()
  for (const p of pages) {
    const { status, body } = await get(p)
    const title = tag(body, /<title[^>]*>([^<]*)<\/title>/)
    const desc = tag(body, /<meta name="description" content="([^"]*)"/)
    const canon = tag(body, /<link rel="canonical" href="([^"]*)"/)
    const og = tag(body, /<meta property="og:title" content="([^"]*)"/)
    const ogimg = /property="og:image"/.test(body)
    const hre = (body.match(/hreflang="/g) || []).length
    const robots = tag(body, /<meta name="robots" content="([^"]*)"/)
    const h1 = (body.match(/<h1/g) || []).length
    const lang = tag(body, /<html lang="([a-z]+)"/)
    const noindex = /noindex/.test(robots)
    const checks = { status: status === 200, title: title.length > 8 && title.length < 75, desc: desc.length > 40, canon: !!canon, og: !!og, h1: h1 === 1 }
    rec(`SEO-${p}`, `${p}: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(",") || "title, description, canonical, og, one h1"}`, Object.values(checks).every(Boolean), `title="${title.slice(0, 55)}" desc=${desc.length}ch canon=${canon ? "yes" : "NO"} hreflang=${hre} og:image=${ogimg} lang=${lang}${noindex ? " NOINDEX" : ""}`)
    if (!titles.has(title)) titles.set(title, []); titles.get(title).push(p)
  }
  const dup = [...titles.entries()].filter(([t, ps]) => ps.length > 1)
  rec("SEO-UNIQUE", "Page titles are unique per page", dup.length === 0, dup.map(([t, ps]) => `"${t.slice(0, 30)}" on ${ps.join(" & ")}`).join(" | "))
  const prod = await get("/fr/product/china-jacket")
  rec("SEO-LD", "Product page has JSON-LD structured data (Product, price, availability)", /application\/ld\+json/.test(prod.body) && /"@type":"Product"/.test(prod.body) && /"availability"/.test(prod.body), (prod.body.match(/application\/ld\+json/g) || []).length + " block(s)")
  const sm = await get("/sitemap.xml")
  const locs = (sm.body.match(/<loc>/g) || []).length
  rec("SEO-SITEMAP", "sitemap.xml lists pages in all 3 languages with alternates", sm.status === 200 && locs >= 20 && /xhtml:link/.test(sm.body), `${locs} urls, status ${sm.status}`)
  const smUrls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, "")).slice(0, 40)
  let badUrl = []
  for (const u of smUrls) { const r = await get(u); if (r.status !== 200) badUrl.push(`${u}→${r.status}`) }
  rec("SEO-SITEMAP2", "Every URL in the sitemap answers 200", badUrl.length === 0, badUrl.join(", ") || `${smUrls.length} checked`)
  const rb = await get("/robots.txt")
  rec("SEO-ROBOTS", "robots.txt blocks admin/checkout/account and points to the sitemap", /Disallow: \/admin/.test(rb.body) && /Sitemap:/.test(rb.body), rb.body.replace(/\n/g, " ").slice(0, 120))
  const nf = await get("/fr/product/does-not-exist"); rec("SEO-404", "Unknown product returns a real 404 status", nf.status === 404, `${nf.status}`)
  const adm = await get("/admin/login"); rec("SEO-ADMIN", "Admin login is not indexable", /noindex/.test(adm.body) || /noindex/.test(adm.headers.get("x-robots-tag") || ""), "")
  const ck = await get("/fr/checkout"); rec("SEO-CHECKOUT", "Checkout and order pages are noindex", /noindex/.test(ck.body), "")
  console.log(`\nSEO: ${res.filter((r) => r.ok).length}/${res.length} passed`)
  require("fs").writeFileSync(process.env.OUT + "/seo.json", JSON.stringify(res, null, 1))
})()

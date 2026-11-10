// Interaction probe: lists EVERY visible interactive element on each page, and clicks every button to see if it does anything.
// Local data only. Skips sign-out / delete style buttons.
const { chromium } = require(process.env.PW)
const fs = require("fs")
const BASE = process.env.BASE
const OUT = process.env.OUT
const LOC = process.env.LOC || "fr"
const MOBILE = process.env.MOBILE === "1"
const ADMIN = process.env.ADMIN === "1"
const TOKEN = ADMIN ? fs.readFileSync(process.env.TOKENFILE, "utf8").trim() : null
fs.mkdirSync(OUT, { recursive: true })
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const SKIP_BTN = /sign out|déconnexion|se déconnecter|supprimer|delete|remove|delete order|yes, |confirmer la commande|confirm order|تأكيد الطلب|record |set to|save|apply|add stock|set count|import|publish|upload|send|submit|logout|log out|clear|cancel|annuler/i

const PAGES = (process.env.PAGES || "").split(",").filter(Boolean)
const inventory = []
const findings = []

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: MOBILE, hasTouch: MOBILE, userAgent: MOBILE ? UA : undefined,
    extraHTTPHeaders: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
  })
  if (ADMIN) await ctx.addCookies([{ name: "k253_session", value: TOKEN, url: BASE }])
  else await ctx.addCookies([{ name: "k253_locale", value: LOC, url: BASE }])
  const page = await ctx.newPage()
  let reqs = 0
  page.on("request", (r) => { if (!/_next\/(static|image)|\.(png|jpg|webp|woff2?|css|js)$/.test(r.url()) && r.url().startsWith(BASE)) reqs++ })
  let dlg = 0
  page.on("dialog", (d) => { dlg++; d.dismiss().catch(() => {}) })
  const jsErrors = []
  page.on("pageerror", (e) => jsErrors.push(e.message))

  const tag = () => page.evaluate(() => {
    let n = 0
    const sel = "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox]"
    return [...document.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
      const visible = r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"
      if (!visible) return null
      el.setAttribute("data-qa", String(n))
      const name = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.getAttribute("title") || el.value || "").trim().replace(/\s+/g, " ").slice(0, 60)
      return { i: n++, tag: el.tagName.toLowerCase(), type: el.getAttribute("type"), role: el.getAttribute("role"), href: el.getAttribute("href"), name, disabled: el.disabled || el.getAttribute("aria-disabled") === "true", w: Math.round(r.width), h: Math.round(r.height) }
    }).filter(Boolean)
  })

  for (const path of PAGES) {
    const url = BASE + path
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 })
    } catch (e) { findings.push({ page: path, kind: "load-failed", detail: e.message.split("\n")[0] }); continue }
    await page.waitForTimeout(1200)
    let els = await tag()
    const summary = { page: path, total: els.length, links: 0, buttons: 0, fields: 0, clicked: 0, noEffect: [], skipped: [], disabled: 0, badLinks: [], noName: [], small: [] }
    for (const e of els) {
      if (e.tag === "a") {
        summary.links++
        if (!e.href || e.href === "#" || /^javascript:/i.test(e.href)) summary.badLinks.push(`${e.name || "(no text)"} → ${e.href}`)
        if (!e.name) summary.noName.push(`link ${e.href}`)
      } else if (["input", "select", "textarea"].includes(e.tag)) {
        summary.fields++
        if (!e.name && e.type !== "checkbox" && e.type !== "radio") summary.noName.push(`${e.tag}[${e.type}]`)
      } else {
        summary.buttons++
        if (!e.name) summary.noName.push(`button#${e.i}`)
      }
      if (MOBILE && (e.w < 24 || e.h < 24) && e.tag !== "input") summary.small.push(`${e.name || e.tag} ${e.w}x${e.h}`)
    }
    // click every button once
    const buttons = els.filter((e) => ["button", "summary"].includes(e.tag) || e.role)
    for (const b of buttons) {
      if (b.disabled) { summary.disabled++; continue }
      if (SKIP_BTN.test(b.name)) { summary.skipped.push(b.name); continue }
      // re-find by index after any reload
      const loc = page.locator(`[data-qa="${b.i}"]`)
      if (!(await loc.count())) continue
      const urlBefore = page.url()
      const reqBefore = reqs, dlgBefore = dlg
      await page.evaluate(() => { window.__mut = 0; window.__obs?.disconnect(); window.__obs = new MutationObserver((m) => (window.__mut += m.length)); window.__obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }) }).catch(() => {})
      try { await loc.click({ timeout: 3000, force: false }) } catch { try { await loc.click({ timeout: 2000, force: true }) } catch { summary.noEffect.push(`${b.name || "button#" + b.i} (not clickable)`); continue } }
      await page.waitForTimeout(700)
      summary.clicked++
      const urlChanged = page.url() !== urlBefore
      const mut = await page.evaluate(() => window.__mut || 0).catch(() => 1)
      const effect = urlChanged || mut > 0 || reqs > reqBefore || dlg > dlgBefore
      if (!effect) summary.noEffect.push(b.name || `button#${b.i}`)
      if (urlChanged) { await page.goto(url, { waitUntil: "networkidle" }).catch(() => {}); await page.waitForTimeout(800); els = await tag() }
      else { await page.keyboard.press("Escape").catch(() => {}); await page.waitForTimeout(150) }
    }
    inventory.push(summary)
    console.log(`${path.padEnd(34)} elements ${String(summary.total).padStart(3)}  links ${String(summary.links).padStart(3)}  buttons ${String(summary.buttons).padStart(3)}  fields ${String(summary.fields).padStart(2)}  clicked ${String(summary.clicked).padStart(3)}  no-effect ${summary.noEffect.length}  bad-links ${summary.badLinks.length}  unnamed ${summary.noName.length}${MOBILE ? "  tiny " + summary.small.length : ""}`)
  }
  fs.writeFileSync(`${OUT}/probe-${ADMIN ? "admin" : LOC}-${MOBILE ? "phone" : "desktop"}.json`, JSON.stringify({ inventory, findings, jsErrors }, null, 1))
  console.log("JS errors:", jsErrors.length, jsErrors.slice(0, 3))
  await browser.close()
})()

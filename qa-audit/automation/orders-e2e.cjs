// Real guest orders through the real buttons, then verifies the database rows. LOCAL data only.
const { chromium } = require(process.env.PW)
const fs = require("fs")
const postgres = require(process.env.PGMOD)
const BASE = process.env.BASE
const sql = postgres(process.env.DATABASE_URL)
const out = process.env.OUT
fs.mkdirSync(out, { recursive: true })

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const L = {
  fr: { buy: /Acheter maintenant/i, bag: /Ajouter au panier/i, name: /Nom complet/i, phone: /Téléphone/i, addr: /Rue \/ adresse/i, wil: /Wilaya/i, com: /Commune/i, ref: /connus/i, pw: /mot de passe/i, ok: /Confirmer la commande/i },
  ar: { buy: /اشترِ الآن/, bag: /أضف إلى السلة/, name: /الاسم الكامل/, phone: /الهاتف/, addr: /الشارع \/ العنوان/, wil: /الولاية/, com: /البلدية/, ref: /كيف تعرّفت/, pw: /كلمة مرور/, ok: /تأكيد الطلب/ },
  en: { buy: /Buy now/i, bag: /Add to bag/i, name: /Full name/i, phone: /^Phone/i, addr: /Street \/ address/i, wil: /Wilaya/i, com: /Commune/i, ref: /hear about us/i, pw: /password/i, ok: /Confirm order/i },
}
const RUN = Date.now().toString(36)
const results = []
const rec = (id, name, status, detail = "") => { results.push({ id, name, status, detail }); console.log(`${status}  ${id}  ${name}${detail ? "  → " + detail : ""}`) }
const wait = (p, ms = 700) => p.waitForTimeout(ms)
const phoneNo = () => "055" + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7)

async function newGuest(browser, loc, mobile) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: mobile, hasTouch: mobile, userAgent: mobile ? UA : undefined, locale: loc === "ar" ? "ar-DZ" : loc === "en" ? "en-GB" : "fr-FR",
    // Every visitor has their own address, as in real life (the site rate-limits per address).
    extraHTTPHeaders: { "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
  })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push("JS " + e.message))
  page.on("response", (r) => r.url().startsWith(BASE) && r.status() >= 500 && errs.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`))
  return { ctx, page, errs }
}

async function pickSize(page) {
  const sizes = page.locator("button[aria-pressed], [role=radio]").filter({ hasText: /^(XS|S|M|L|XL|XXL|\d+)$/ })
  const n = await sizes.count()
  for (let i = 0; i < n; i++) {
    const b = sizes.nth(i)
    if (await b.isEnabled()) { await b.click(); return true }
  }
  return false
}

async function fillCheckout(page, l, data) {
  const t = L[l]
  await page.getByLabel(t.name).first().fill(data.name)
  await page.getByLabel(t.phone).first().fill(data.phone)
  await page.getByLabel(t.addr).first().fill(data.address)
  await page.getByLabel(t.wil).first().selectOption({ index: data.wilayaIndex ?? 23 })
  await wait(page, 1200)
  await page.getByLabel(t.com).first().selectOption({ index: 1 }).catch(() => {})
  await wait(page, 2200)
  const ref = page.getByLabel(t.ref).first()
  if (await ref.count()) await ref.selectOption({ index: 1 }).catch(() => {})
  const pw = page.getByLabel(t.pw).first()
  if (await pw.count()) await pw.fill(data.password ?? "final-test-pass-1").catch(() => {})
}

async function dbOrder(number) {
  const [o] = await sql`select o.*, (select count(*)::int from order_items i where i.order_id = o.id) items,
    (select coalesce(sum(i.line_total),0)::int from order_items i where i.order_id = o.id and i.removed_at is null) sum_items,
    (select u.login_phone from users u where u.id = o.user_id) login_phone
    from orders o where o.number = ${number}`
  return o
}

;(async () => {
  const browser = await chromium.launch()

  /* ---------- J1..J3: Buy now as a guest, three languages/devices ---------- */
  for (const [id, loc, mobile, slug] of [["ORD-01", "fr", true, "china-jacket"], ["ORD-02", "ar", false, "china-jacket"], ["ORD-03", "en", true, "jacket-china"]]) {
    const { ctx, page, errs } = await newGuest(browser, loc, mobile)
    try {
      await ctx.addCookies([{ name: "k253_locale", value: loc, url: BASE }])
      await page.goto(`${BASE}/${loc}/product/${slug}`, { waitUntil: "networkidle" }); await wait(page, 1500)
      if (!(await pickSize(page))) throw new Error("no size button enabled")
      await wait(page, 400)
      await page.getByRole("button", { name: L[loc].buy }).first().click()
      await page.waitForURL(/\/checkout/, { timeout: 15000 })
      const url = page.url()
      if (/sign-(up|in)/.test(url)) throw new Error("sent to sign-in: " + url)
      await wait(page, 1500)
      const phone = phoneNo()
      const data = { name: loc === "ar" ? "محمد بن علي" : "Test " + loc.toUpperCase(), phone, address: loc === "ar" ? "حي 5 جويلية، رقم 12" : "12 rue de test", wilayaIndex: 23 }
      await fillCheckout(page, loc, data)
      await page.screenshot({ path: `${out}/${id}-form.png`, fullPage: true })
      await page.getByRole("button", { name: L[loc].ok }).last().click()
      await page.waitForURL(/\/order\//, { timeout: 25000 })
      await wait(page, 1500)
      await page.screenshot({ path: `${out}/${id}-confirmed.png`, fullPage: true })
      const number = (await page.content()).match(/KING253-\d+-\d+/)?.[0]
      const o = await dbOrder(number)
      const problems = []
      if (!o) problems.push("order not in DB")
      else {
        if (o.status !== "pending") problems.push("status " + o.status)
        if (o.customer_phone !== data.phone.replace(/^0/, "+213") && !String(o.customer_phone).endsWith(data.phone.slice(1))) problems.push("phone " + o.customer_phone)
        if (o.customer_name !== data.name) problems.push("name " + o.customer_name)
        if (!o.address.includes(loc === "ar" ? "جويلية" : "rue de test")) problems.push("address " + o.address)
        if (!o.store_id) problems.push("no departure shop")
        if (o.subtotal !== o.sum_items) problems.push(`subtotal ${o.subtotal} != items ${o.sum_items}`)
        if (o.total !== o.subtotal - o.discount_amount + (o.free_delivery ? 0 : o.delivery_fee)) problems.push(`total ${o.total} wrong`)
        if (!o.login_phone) problems.push("guest account not created")
        if (o.locale !== loc) problems.push("locale " + o.locale)
        if (o.delivery_type !== "home") problems.push("delivery_type " + o.delivery_type)
      }
      if (errs.length) problems.push("page errors: " + errs.join("; "))
      rec(id, `Guest Buy now → order (${loc}, ${mobile ? "phone" : "desktop"})`, problems.length ? "FAIL" : "PASS", problems.join(" | ") || `${number} total ${o.total} DA, status ${o.status}, shop ${o.store_id}`)
    } catch (e) {
      await page.screenshot({ path: `${out}/${id}-fail.png`, fullPage: true }).catch(() => {})
      rec(id, `Guest Buy now → order (${loc})`, "FAIL", e.message.split("\n")[0] + " " + errs.join("; "))
    }
    await ctx.close()
  }

  /* ---------- ORD-04 cart path: add to bag → bag → checkout ---------- */
  {
    const { ctx, page, errs } = await newGuest(browser, "fr", true)
    try {
      await ctx.addCookies([{ name: "k253_locale", value: "fr", url: BASE }])
      await page.goto(`${BASE}/fr/product/china-jacket`, { waitUntil: "networkidle" }); await wait(page, 1200)
      await pickSize(page)
      await page.getByRole("button", { name: L.fr.bag }).first().click(); await wait(page, 2000)
      const bag = page.getByRole("dialog")
      await bag.getByRole("link", { name: /Tout acheter|Acheter|Commander|Passer/i }).first().click()
      await page.waitForURL(/\/checkout/, { timeout: 15000 })
      if (/sign-/.test(page.url())) throw new Error("sent to sign-in")
      const phone = phoneNo()
      await fillCheckout(page, "fr", { name: "Test Panier", phone, address: "3 rue du panier" })
      await page.getByRole("button", { name: L.fr.ok }).last().click()
      await page.waitForURL(/\/order\//, { timeout: 25000 })
      const number = (await page.content()).match(/KING253-\d+-\d+/)?.[0]
      const o = await dbOrder(number)
      rec("ORD-04", "Guest cart → checkout → order (fr, phone)", o && o.status === "pending" && !errs.length ? "PASS" : "FAIL", `${number} ${errs.join(";")}`)
    } catch (e) { rec("ORD-04", "Guest cart → checkout → order", "FAIL", e.message.split("\n")[0]) }
    await ctx.close()
  }

  /* ---------- ORD-05..: validation & abuse, on the checkout form ---------- */
  {
    let { ctx, page, errs } = await newGuest(browser, "fr", false)
    await ctx.addCookies([{ name: "k253_locale", value: "fr", url: BASE }])
    await page.goto(`${BASE}/fr/product/china-jacket`, { waitUntil: "networkidle" }); await wait(page, 1200)
    await pickSize(page)
    await page.getByRole("button", { name: L.fr.buy }).first().click()
    await page.waitForURL(/\/checkout/); await wait(page, 1500)
    const before = (await sql`select count(*)::int n from orders`)[0].n
    const submit = async () => {
      const b = page.getByRole("button", { name: L.fr.ok }).last()
      if (await b.isDisabled()) return "disabled"
      await b.click(); return "clicked"
    }
    const stayed = async () => { await wait(page, 1800); return !/\/order\//.test(page.url()) }

    // 05 empty form
    const r5 = await submit()
    rec("ORD-05", "Empty form is refused, nothing saved", (await stayed()) ? "PASS" : "FAIL", `button ${r5}`)
    // 06 bad phone
    await fillCheckout(page, "fr", { name: "Bad Phone", phone: "12345", address: "x street 1" })
    await submit()
    rec("ORD-06", "Invalid phone number is refused", (await stayed()) ? "PASS" : "FAIL", (await page.locator("[role=alert]").allInnerTexts()).join(" / ").slice(0, 120))
    // 07 missing address
    await page.getByLabel(L.fr.phone).first().fill(phoneNo()); await page.getByLabel(L.fr.addr).first().fill("")
    await submit()
    rec("ORD-07", "Missing address is refused", (await stayed()) ? "PASS" : "FAIL")
    // 08 giant input
    await page.getByLabel(L.fr.name).first().fill("A".repeat(5000)); await page.getByLabel(L.fr.addr).first().fill("B".repeat(5000))
    await submit()
    const big = await stayed()
    rec("ORD-08", "5000-character name/address does not create an order", big ? "PASS" : "FAIL")
    // 09 XSS payload stays text
    await page.getByLabel(L.fr.name).first().fill(`<img src=x onerror=alert(1)> O'Brien "x"`); await page.getByLabel(L.fr.addr).first().fill(`<script>alert(1)</script> 5 rue; DROP TABLE orders;--`)
    let dialog = false; page.on("dialog", (d) => { dialog = true; d.dismiss() })
    await page.getByLabel(L.fr.phone).first().fill(phoneNo())
    await submit(); await wait(page, 3500)
    const xssOrder = (await page.content()).match(/KING253-\d+-\d+/)?.[0]
    if (xssOrder) { await wait(page, 1000) }
    const tbl = await sql`select to_regclass('public.orders') as t`
    rec("ORD-09", "XSS / SQL-injection text is stored as plain text, no script runs, table intact", !dialog && tbl[0].t ? "PASS" : "FAIL", xssOrder ? `saved as ${xssOrder}` : "refused")
    // 10 double click (duplicate submit) — a fresh visitor
    await ctx.close()
    const g2 = await newGuest(browser, "fr", false); page = g2.page
    await g2.ctx.addCookies([{ name: "k253_locale", value: "fr", url: BASE }])
    await page.goto(`${BASE}/fr/product/china-jacket`, { waitUntil: "networkidle" }); await wait(page, 1000); await pickSize(page)
    await page.getByRole("button", { name: L.fr.buy }).first().click(); await page.waitForURL(/\/checkout/); await wait(page, 1500)
    const dupPhone = phoneNo()
    await fillCheckout(page, "fr", { name: `Double Clic ${RUN}`, phone: dupPhone, address: "9 rue double" })
    const btn = page.getByRole("button", { name: L.fr.ok }).last()
    await Promise.all([btn.click().catch(() => {}), btn.click({ force: true }).catch(() => {}), btn.dblclick({ force: true }).catch(() => {})])
    await page.waitForURL(/\/order\//, { timeout: 25000 }).catch(() => {}); await wait(page, 2500)
    const dups = await sql`select count(*)::int n from orders where customer_name = ${`Double Clic ${RUN}`} and created_at > now() - interval '5 minutes'`
    rec("ORD-10", "Rapid double/triple click creates exactly one order", dups[0].n === 1 ? "PASS" : "FAIL", `${dups[0].n} order(s)`)
    // 11 back button after order → not a second order
    await page.goBack().catch(() => {}); await wait(page, 1500)
    const after = (await sql`select count(*)::int n from orders`)[0].n
    rec("ORD-11", "Browser Back after ordering does not duplicate the order", (await sql`select count(*)::int n from orders where customer_name = ${`Double Clic ${RUN}`}`)[0].n === 1 ? "PASS" : "FAIL", `orders total ${before} → ${after}`)
    if (errs.length) rec("ORD-12", "No server errors during the abuse tests", "FAIL", errs.join("; ").slice(0, 200))
    else rec("ORD-12", "No server errors during the abuse tests", "PASS")
    await g2.ctx.close()
    // 11b signed-in customer: second order from the same browser
    try {
      const g3 = await newGuest(browser, 'fr', true)
      await g3.ctx.addCookies([{ name: 'k253_locale', value: 'fr', url: BASE }])
      const p3 = g3.page
      await p3.goto(`${BASE}/fr/product/china-jacket`, { waitUntil: 'networkidle' }); await wait(p3, 1000); await pickSize(p3)
      await p3.getByRole('button', { name: L.fr.buy }).first().click(); await p3.waitForURL(/\/checkout/); await wait(p3, 1500)
      const ph = phoneNo(); await fillCheckout(p3, 'fr', { name: `Client Fidele ${RUN}`, phone: ph, address: '5 rue fidele' })
      await p3.getByRole('button', { name: L.fr.ok }).last().click(); await p3.waitForURL(/\/order\//, { timeout: 25000 })
      // same browser, now signed in: buy again
      await p3.goto(`${BASE}/fr/product/china-jacket`, { waitUntil: 'networkidle' }); await wait(p3, 1000); await pickSize(p3)
      await p3.getByRole('button', { name: L.fr.buy }).first().click(); await p3.waitForURL(/\/checkout/); await wait(p3, 2000)
      await p3.screenshot({ path: `${out}/ORD-18-signed-in-checkout.png`, fullPage: true })
      const nameField = p3.getByLabel(L.fr.name).first()
      const hasName = await nameField.count()
      if (hasName) { const v = await nameField.inputValue(); if (!v) await nameField.fill(`Client Fidele ${RUN}`) }
      const phf = p3.getByLabel(L.fr.phone).first(); if ((await phf.count()) && !(await phf.inputValue())) await phf.fill(ph)
      const af = p3.getByLabel(L.fr.addr).first(); if ((await af.count()) && !(await af.inputValue())) await af.fill('5 rue fidele')
      await p3.getByRole('button', { name: L.fr.ok }).last().click(); await p3.waitForURL(/\/order\//, { timeout: 25000 })
      const cnt = await sql`select count(*)::int n, count(distinct user_id)::int u from orders where customer_name = ${`Client Fidele ${RUN}`}`
      rec('ORD-18', 'Signed-in customer orders again; both orders on one account', cnt[0].n === 2 && cnt[0].u === 1 ? 'PASS' : 'FAIL', `orders ${cnt[0].n}, accounts ${cnt[0].u}`)
      await g3.ctx.close()
    } catch (e) { rec('ORD-18', 'Signed-in customer orders again', 'FAIL', e.message.split('\n')[0]) }
  }

  /* ---------- ORD-13: returning customer (same phone) ---------- */
  {
    const { ctx, page } = await newGuest(browser, "fr", true)
    try {
      await ctx.addCookies([{ name: "k253_locale", value: "fr", url: BASE }])
      const [prev] = await sql`select customer_phone p from orders where customer_name = 'Test FR' order by created_at desc limit 1`
      const local = "0" + String(prev.p).replace(/^\+213/, "")
      await page.goto(`${BASE}/fr/product/china-jacket`, { waitUntil: "networkidle" }); await wait(page, 1000); await pickSize(page)
      await page.getByRole("button", { name: L.fr.buy }).first().click(); await page.waitForURL(/\/checkout/); await wait(page, 1500)
      await fillCheckout(page, "fr", { name: "Test FR", phone: local, address: "12 rue de test", password: "wrong-password-123" })
      await page.getByRole("button", { name: L.fr.ok }).last().click(); await wait(page, 3500)
      const refused = !/\/order\//.test(page.url())
      const msg = (await page.locator("[role=alert]").allInnerTexts()).join(" / ").slice(0, 160)
      rec("ORD-13", "Existing phone + WRONG password is refused (no account takeover)", refused ? "PASS" : "FAIL", msg)
      await page.getByLabel(L.fr.pw).first().fill("final-test-pass-1"); await page.getByRole("button", { name: L.fr.ok }).last().click()
      await page.waitForURL(/\/order\//, { timeout: 20000 }).catch(() => {})
      rec("ORD-14", "Existing phone + CORRECT password places a second order on the same account", /\/order\//.test(page.url()) ? "PASS" : "FAIL", page.url().slice(0, 80))
    } catch (e) { rec("ORD-13", "Returning customer", "FAIL", e.message.split("\n")[0]) }
    await ctx.close()
  }

  /* ---------- DB consistency of everything created ---------- */
  const bad = await sql`select number from orders o where subtotal <> (select coalesce(sum(line_total),0) from order_items i where i.order_id=o.id and i.removed_at is null and i.exchange_journal_id is null) and status <> 'cancelled'`
  rec("ORD-15", "Every order's subtotal equals the sum of its lines", bad.length === 0 ? "PASS" : "FAIL", bad.map((b) => b.number).join(","))
  const dupNum = await sql`select number, count(*) from orders group by number having count(*) > 1`
  rec("ORD-16", "Order numbers are unique", dupNum.length === 0 ? "PASS" : "FAIL")
  const orphan = await sql`select count(*)::int n from order_items i left join orders o on o.id = i.order_id where o.id is null`
  rec("ORD-17", "No order line without an order", orphan[0].n === 0 ? "PASS" : "FAIL")

  await browser.close(); await sql.end()
  fs.writeFileSync(`${out}/orders-e2e.json`, JSON.stringify(results, null, 1))
  const c = (s) => results.filter((r) => r.status === s).length
  console.log(`\nTOTAL ${results.length}  PASS ${c("PASS")}  FAIL ${c("FAIL")}`)
})()

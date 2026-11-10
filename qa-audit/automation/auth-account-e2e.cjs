// Customer accounts: sign-in, wrong password, sign-up validation, account page, add email, customer cancels own order, sign out.
// Local data only. Needs a customer created by the orders test (phone + password "final-test-pass-1").
const { chromium } = require(process.env.PW)
const postgres = require("postgres")
const sql = postgres(process.env.DATABASE_URL)
const BASE = process.env.BASE
const out = process.env.OUT
const fs = require("fs"); fs.mkdirSync(out, { recursive: true })
const res = []
const rec = (id, name, ok, d = "") => { res.push({ id, name, ok, d }); console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${name}${d ? "  → " + String(d).slice(0, 140) : ""}`) }
const wait = (p, ms = 900) => p.waitForTimeout(ms)
const ip = () => `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`

;(async () => {
  const browser = await chromium.launch()
  const mk = async (mobile = false) => {
    const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile, extraHTTPHeaders: { "x-forwarded-for": ip() } })
    await ctx.addCookies([{ name: "k253_locale", value: "fr", url: BASE }])
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message)); return { ctx, page, errs }
  }
  const [u] = await sql`select u.id, u.login_phone, u.name from users u where u.role='customer' and u.login_phone is not null and exists (select 1 from orders o where o.user_id=u.id) order by u.created_at desc limit 1`
  const phone = "0" + String(u.login_phone).replace(/^\+213/, "")

  // AUTH-01 wrong password
  {
    const { ctx, page } = await mk()
    await page.goto(`${BASE}/fr/sign-in`, { waitUntil: "networkidle" })
    await page.getByLabel(/Email ou téléphone/).fill(phone); await page.getByLabel(/Mot de passe/).fill("definitely-wrong-1")
    await page.getByRole("button", { name: /Se connecter/ }).click(); await wait(page, 2000)
    const stayed = /sign-in/.test(page.url()); const msg = (await page.locator("[role=status],[role=alert]").allInnerTexts()).join(" ").trim()
    rec("AUTH-01", "Wrong password is refused with a clear message", stayed && msg.length > 5, msg)
    // AUTH-02 right password by PHONE
    await page.getByLabel(/Mot de passe/).fill("final-test-pass-1"); await page.getByRole("button", { name: /Se connecter/ }).click()
    await page.waitForURL(/account/, { timeout: 15000 }).catch(() => {})
    rec("AUTH-02", "Sign in with phone + password opens the account", /account/.test(page.url()), page.url().replace(BASE, ""))
    await wait(page, 1500); await page.screenshot({ path: `${out}/AUTH-account.png`, fullPage: true })
    const body = await page.locator("main").innerText().catch(() => "")
    rec("AUTH-03", "Account page lists the customer's orders", /KING253-\d{8}-\d+/.test(body), (body.match(/KING253-\d{8}-\d+/) || [""])[0])
    // AUTH-04 persistence after refresh
    await page.reload({ waitUntil: "networkidle" }); await wait(page, 800)
    rec("AUTH-04", "Session survives a page refresh", /account/.test(page.url()))
    // AUTH-05 add email via the account form
    await page.getByRole("tab", { name: /Mes informations/i }).click().catch(async () => { await page.getByText(/Mes informations/i).first().click() }); await wait(page, 800)
    const emailField = page.getByLabel(/^Email/).first()
    if (await emailField.count()) {
      const mail = `qa${Date.now()}@example.test`
      await emailField.fill(mail)
      await page.getByRole("button", { name: /Enregistrer|Sauvegarder|Mettre à jour/i }).first().click(); await wait(page, 2200)
      const [row] = await sql`select email from users where id = ${u.id}`
      rec("AUTH-05", "Adding an email on the account page is saved", row.email === mail, row.email)
    } else rec("AUTH-05", "Adding an email on the account page", false, "no email field found")
    // AUTH-06 invalid email refused
    const ef = page.getByLabel(/^Email/).first()
    if (await ef.count()) { await ef.fill("not-an-email"); await page.getByRole("button", { name: /Enregistrer|Sauvegarder|Mettre à jour/i }).first().click(); await wait(page, 1500)
      const [row] = await sql`select email from users where id = ${u.id}`; rec("AUTH-06", "Invalid email is refused on the account page", row.email !== "not-an-email", row.email) }
    // AUTH-07 admin area refused for this customer
    const r = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" }); await wait(page, 800)
    rec("AUTH-07", "Customer is kept out of /admin", !/\/admin$/.test(page.url()) || /login/.test(page.url()), page.url().replace(BASE, ""))
    // AUTH-08 sign out
    await page.goto(`${BASE}/fr/account`, { waitUntil: "networkidle" })
    const so = page.getByRole("button", { name: /Déconnexion|Se déconnecter/i }).first()
    if (await so.count()) { await so.click(); await wait(page, 2000) }
    await page.goto(`${BASE}/fr/account`, { waitUntil: "domcontentloaded" }); await wait(page, 800)
    rec("AUTH-08", "After sign-out the account page needs a sign-in again", /sign-in/.test(page.url()), page.url().replace(BASE, ""))
    await ctx.close()
  }
  // AUTH-09 sign-up validation
  {
    const { ctx, page } = await mk()
    await page.goto(`${BASE}/fr/sign-up`, { waitUntil: "networkidle" }); await wait(page, 600)
    const before = (await sql`select count(*)::int n from users`)[0].n
    await page.getByLabel(/Nom complet/).fill("QA Test"); await page.getByLabel(/^Email/).fill("bad-email"); await page.getByLabel(/Mot de passe/).fill("short")
    await page.getByRole("button", { name: /Créer le compte/ }).click(); await wait(page, 1500)
    rec("AUTH-09", "Sign-up with bad email + short password creates nothing", (await sql`select count(*)::int n from users`)[0].n === before)
    // AUTH-10 duplicate email
    const [ex] = await sql`select email from users where email is not null limit 1`
    await page.getByLabel(/^Email/).fill(ex.email); await page.getByLabel(/Mot de passe/).fill("Valid-pass-12345")
    const ref = page.getByLabel(/connus/).first(); if (await ref.count()) await ref.selectOption({ index: 1 }).catch(() => {})
    await page.getByRole("button", { name: /Créer le compte/ }).click(); await wait(page, 2200)
    const dup = (await sql`select count(*)::int n from users where lower(email) = lower(${ex.email})`)[0].n
    rec("AUTH-10", "Sign-up with an existing email does not create a duplicate account", dup === 1, `${dup} account(s)`)
    await ctx.close()
  }
  // AUTH-11 customer cancels own order via the order page link (token)
  {
    const { ctx, page } = await mk(true)
    const [o] = await sql`select o.id, o.number, o.access_token, o.store_id from orders o where o.status='pending' and o.customer_name like 'Test%' order by o.created_at desc limit 1`
    const stockBefore = await sql`select coalesce(sum(reserved),0)::int r from store_stock where store_id=${o.store_id}`
    await page.goto(`${BASE}/fr/order/${o.number}?t=${o.access_token}`, { waitUntil: "networkidle" }); await wait(page, 1200)
    await page.screenshot({ path: `${out}/AUTH-order-page.png`, fullPage: true })
    const cancel = page.getByRole("button", { name: /Annuler cette commande/i }).first()
    if (await cancel.count()) {
      await cancel.click(); await wait(page, 600)
      const yes = page.getByRole("button", { name: /Oui|Confirmer|Annuler la commande/i }).last(); if (await yes.count()) await yes.click()
      await wait(page, 2500)
      const [after] = await sql`select status from orders where id=${o.id}`
      const stockAfter = await sql`select coalesce(sum(reserved),0)::int r from store_stock where store_id=${o.store_id}`
      rec("AUTH-11", "Customer cancels own order with the secret link: status Cancelled, stock released", after.status === "cancelled" && stockAfter[0].r < stockBefore[0].r, `${after.status}; reserved ${stockBefore[0].r} → ${stockAfter[0].r}`)
    } else rec("AUTH-11", "Customer cancels own order", false, "no cancel button")
    // AUTH-12 wrong token
    const r2 = await page.goto(`${BASE}/fr/order/${o.number}?t=wrongtoken123`, { waitUntil: "domcontentloaded" })
    rec("AUTH-12", "Order page with a wrong secret token shows 404 (no order data leaked)", r2.status() === 404, `${r2.status()}`)
    const r3 = await page.goto(`${BASE}/fr/order/${o.number}`, { waitUntil: "domcontentloaded" })
    rec("AUTH-13", "Order page without a token shows 404", r3.status() === 404, `${r3.status()}`)
    await ctx.close()
  }
  console.log(`\nAuth/account: ${res.filter((r) => r.ok).length}/${res.length} passed`)
  fs.writeFileSync(`${out}/auth-account.json`, JSON.stringify(res, null, 1))
  await browser.close(); await sql.end()
})()

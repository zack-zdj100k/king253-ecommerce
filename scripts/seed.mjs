// Seeds categories and imports the campaign pieces as DRAFT products.
// Safe to run repeatedly. Never invents prices, sizes or stock — the admin
// completes each product (price, variants, stock) and publishes it.
import postgres from "postgres"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")
const sql = postgres(url, { max: 1, onnotice: () => {} })

const categories = [
  ["t-shirts", "T-Shirts", "The basics"],
  ["hoodies", "Hoodies", "Heavyweight"],
  ["jackets", "Jackets", "Outer layer"],
  ["pants", "Pants", "Built to move"],
  ["denim", "Denim", "Washed & worn"],
  ["accessories", "Accessories", "The details"],
]

// Garments visible in the supplied campaign photography (image crops only).
const P = "/images/hero/"
const drafts = [
  ["look-01-hoodie", "Distressed Graphic Hoodie", "hoodies", `${P}1.png`, 56, 47, 2.1],
  ["look-02-bomber", "Distressed Denim Bomber", "jackets", `${P}2.jpg`, 50, 42, 2],
  ["look-03-varsity", "Washed Varsity Jacket", "jackets", `${P}3.jpg`, 67, 40, 2],
  ["look-04-work-jacket", "Canvas Work Jacket", "jackets", `${P}4.jpg`, 64, 38, 2],
  ["look-05-cargo-denim", "Vintage Wash Cargo Denim", "denim", `${P}5.jpg`, 64, 72, 2],
  ["look-01-cargo", "Washed Black Cargo Pants", "pants", `${P}1.png`, 50, 74, 2],
  ["look-02-tee", "Collegiate Graphic Tee", "t-shirts", `${P}2.jpg`, 50, 40, 2.6],
  ["look-03-tee", "Heavyweight Logo Tee", "t-shirts", `${P}3.jpg`, 66, 30, 2.6],
  ["look-03-cargo", "Charcoal Cargo Pants", "pants", `${P}3.jpg`, 66, 74, 2],
  ["look-04-tee", "Graphic Print Tee", "t-shirts", `${P}4.jpg`, 64, 33, 2.6],
  ["look-05-beanie", "Knit Beanie", "accessories", `${P}5.jpg`, 64.5, 13, 3],
  ["look-04-chain", "Silver Chain", "accessories", `${P}4.jpg`, 64, 23, 3],
]

await sql.begin(async (tx) => {
  for (const [i, [slug, name, tagline]] of categories.entries()) {
    await tx`insert into categories (slug, name, tagline, sort_order) values (${slug}, ${name}, ${tagline}, ${i})
      on conflict (slug) do nothing`
  }
  let created = 0
  for (const [slug, name, cat, url, fx, fy, zoom] of drafts) {
    const [product] = await tx`
      insert into products (slug, name, category_id, gender, status, featured)
      values (${slug}, ${name}, (select id from categories where slug = ${cat}), 'men', 'draft', ${slug !== "look-04-chain"})
      on conflict (slug) do nothing returning id`
    if (!product) continue
    created++
    await tx`insert into product_images (product_id, url, alt, is_main, focus_x, focus_y, zoom)
      values (${product.id}, ${url}, ${name + " — KING 253 campaign"}, true, ${fx}, ${fy}, ${zoom})`
    // A second, uncropped shot of the full look for the gallery.
    await tx`insert into product_images (product_id, url, alt, sort_order, focus_x, focus_y, zoom)
      values (${product.id}, ${url}, ${name + " — full look"}, 1, ${fx}, 50, 1)`
  }
  console.log(`Categories ready. ${created} draft product(s) imported.`)
})
await sql.end()

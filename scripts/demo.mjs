// DEVELOPMENT ONLY — fills the local database with clearly-labelled DEMO data
// so checkout, stock and admin flows can be tried before real data exists.
//   • every SKU starts with "DEMO-" (the admin shows a warning while any exist)
//   • prices / stock here are placeholders, NOT business data
//   • no shops are created — add the real ones in Admin → Locations
// Remove everything with: npm run db:reset
import postgres from "postgres"

import { assertLocalDatabase } from "./local-only.mjs"

assertLocalDatabase(process.env.DATABASE_URL)
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })

const plan = {
  "look-01-hoodie": { price: 6500, colour: ["Washed black", "#2b2b2b"], sizes: { S: 4, M: 6, L: 5, XL: 2 } },
  "look-02-bomber": { price: 12000, colour: ["Washed black", "#363636"], sizes: { M: 3, L: 3, XL: 1 } },
  "look-03-varsity": { price: 11500, sale: 9900, colour: ["Charcoal / stone", "#55534a"], sizes: { M: 2, L: 4 } },
  "look-04-work-jacket": { price: 10500, colour: ["Olive canvas", "#6b6448"], sizes: { M: 5, L: 5, XL: 3 } },
  "look-05-cargo-denim": { price: 7800, colour: ["Vintage wash", "#5a626b"], sizes: { "30": 3, "32": 4, "34": 2 } },
  "look-01-cargo": { price: 6900, colour: ["Washed black", "#303030"], sizes: { "30": 2, "32": 5, "34": 3 } },
  "look-02-tee": { price: 3500, colour: ["Heather grey", "#7d7d7b"], sizes: { S: 6, M: 8, L: 8, XL: 4 } },
  "look-03-tee": { price: 3200, colour: ["Off-white", "#e8e4da"], sizes: { S: 5, M: 7, L: 6 } },
  "look-03-cargo": { price: 6900, colour: ["Charcoal", "#3f4042"], sizes: { "30": 2, "32": 2 } },
  "look-04-tee": { price: 3400, colour: ["Faded black", "#2f2f2f"], sizes: { M: 1, L: 0 } },
  "look-05-beanie": { price: 1800, colour: ["Tan", "#8a6a4c"], sizes: { "One size": 10 } },
  "look-04-chain": { price: 2500, colour: ["Silver", "#c7c7c7"], sizes: { "One size": 0 } },
}

await sql.begin(async (tx) => {
  for (const [slug, p] of Object.entries(plan)) {
    const [product] = await tx`update products set status = 'published', price = ${p.price}, sale_price = ${p.sale ?? null},
      published_at = coalesce(published_at, now()),
      short_description = coalesce(short_description, 'DEMO description — replace in the admin.'),
      material = coalesce(material, 'DEMO — set the real fabric in the admin'),
      care = coalesce(care, 'DEMO — set real care instructions')
      where slug = ${slug} returning id`
    if (!product) continue
    let i = 0
    for (const [size, stock] of Object.entries(p.sizes)) {
      const sku = `DEMO-${slug.toUpperCase()}-${size.replace(/\s+/g, "").toUpperCase()}`
      await tx`insert into product_variants (product_id, sku, size, color, color_hex, physical, sort_order)
        values (${product.id}, ${sku}, ${size}, ${p.colour[0]}, ${p.colour[1]}, ${stock}, ${i++})
        on conflict (sku) do nothing`
    }
  }
})
console.log("DEMO data loaded (local only). Remove it with: npm run db:reset")
await sql.end()

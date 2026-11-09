// Imports courier price lists into delivery_rates / delivery_desks.
//   node --env-file=.env.local scripts/import-delivery.mjs rates data/delivery/rates.csv
//   node --env-file=.env.local scripts/import-delivery.mjs desks data/delivery/desks.csv
// Same format and checks as Admin → Delivery → Import (see src/lib/delivery-csv.mjs).
// Nothing is written if any line is wrong; existing rows are updated, never deleted.
import { readFileSync } from "node:fs"

import postgres from "postgres"

import { readDeliveryCsv } from "../src/lib/delivery-csv.mjs"

const [kind, file] = process.argv.slice(2)
if (!["rates", "desks"].includes(kind) || !file) {
  console.error("Usage: node --env-file=.env scripts/import-delivery.mjs <rates|desks> <file.csv>")
  process.exit(1)
}
const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

const sql = postgres(url, { max: 1, onnotice: () => {} })
try {
  const shops = await sql`select id, slug from stores`
  const wilayas = await sql`select code, name_fr as fr, name_ar as ar from wilayas`
  const { rows, errors } = readDeliveryCsv(kind, readFileSync(file, "utf8"), { shops, wilayas })
  if (errors.length) {
    console.error(`Nothing imported — ${errors.length} problem(s):\n${errors.join("\n")}`)
    process.exitCode = 1
  } else {
    await sql.begin(async (tx) => {
      for (const r of rows) {
        if (kind === "rates") {
          await tx`insert into delivery_rates (store_id, wilaya_code, home_price, desk_price)
            values (${r.storeId}, ${r.wilayaCode}, ${r.homePrice}, ${r.deskPrice})
            on conflict (store_id, wilaya_code) do update
            set home_price = excluded.home_price, desk_price = excluded.desk_price, updated_at = now()`
        } else {
          await tx`insert into delivery_desks (store_id, wilaya_code, commune, name, address, desk_price)
            values (${r.storeId}, ${r.wilayaCode}, ${r.commune}, ${r.name}, ${r.address}, ${r.deskPrice})
            on conflict (store_id, wilaya_code, name) do update
            set commune = excluded.commune, address = excluded.address, desk_price = excluded.desk_price, active = true, updated_at = now()`
        }
      }
    })
    console.log(`Imported ${rows.length} ${kind} row(s).`)
  }
} finally {
  await sql.end()
}

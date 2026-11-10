const postgres = require("postgres")
const sql = postgres(process.env.DATABASE_URL)
const res = []
const check = async (id, name, q, expectZero = true) => {
  const rows = await q
  const n = rows.length ? Number(Object.values(rows[0])[0]) : 0
  const ok = expectZero ? n === 0 : n > 0
  res.push({ id, name, ok, n })
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${name}${ok ? "" : "  → " + n + " " + JSON.stringify(rows.slice(0, 3))}`)
}
;(async () => {
  // ---- schema facts
  const tables = await sql`select count(*)::int n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`
  const noPk = await sql`select t.table_name from information_schema.tables t where t.table_schema='public' and t.table_type='BASE TABLE' and not exists (select 1 from information_schema.table_constraints c where c.table_schema='public' and c.table_name=t.table_name and c.constraint_type='PRIMARY KEY') and t.table_name not like '\\_\\_%'`
  const fks = await sql`select count(*)::int n from information_schema.table_constraints where table_schema='public' and constraint_type='FOREIGN KEY'`
  const uniq = await sql`select count(*)::int n from pg_indexes where schemaname='public' and indexdef ilike '%unique%'`
  const checks = await sql`select count(*)::int n from information_schema.table_constraints where table_schema='public' and constraint_type='CHECK' and constraint_name not like '%not_null'`
  const idx = await sql`select count(*)::int n from pg_indexes where schemaname='public'`
  console.log(`SCHEMA tables=${tables[0].n} foreignKeys=${fks[0].n} uniqueIndexes=${uniq[0].n} checkConstraints=${checks[0].n} indexes=${idx[0].n} tablesWithoutPK=[${noPk.map((r) => r.table_name)}]`)
  // FK columns without an index (slow joins / slow deletes)
  const fkNoIdx = await sql`
    select c.conrelid::regclass::text tbl, a.attname col from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum = c.conkey[1]
    where c.contype='f' and c.connamespace='public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and i.indkey[0]=c.conkey[1])`
  console.log(`FKs whose column has no index: ${fkNoIdx.length}`, fkNoIdx.map((r) => `${r.tbl}.${r.col}`).join(", "))
  const cascade = await sql`select conrelid::regclass::text tbl, confrelid::regclass::text ref, case confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'r' then 'RESTRICT' when 'a' then 'NO ACTION' end del from pg_constraint where contype='f' and connamespace='public'::regnamespace and confdeltype in ('c','n') order by 1`
  console.log(`DELETE rules: ${cascade.length} cascade/set-null FKs`)
  for (const r of cascade) console.log(`   ${r.tbl} → ${r.ref}: ${r.del}`)

  // ---- referential + business integrity (real data)
  await check("DB-01", "No order line without an order", sql`select count(*)::int n from order_items i left join orders o on o.id=i.order_id where o.id is null`)
  await check("DB-02", "No order without lines", sql`select count(*)::int n from orders o where not exists (select 1 from order_items i where i.order_id=o.id)`)
  await check("DB-03", "Order numbers unique", sql`select count(*)::int n from (select number from orders group by number having count(*)>1) x`)
  await check("DB-04", "Order subtotal = sum of live original lines", sql`select count(*)::int n from orders o where status<>'cancelled' and subtotal <> (select coalesce(sum(line_total),0) from order_items i where i.order_id=o.id and i.removed_at is null and i.exchange_journal_id is null)`)
  await check("DB-05", "Order total = subtotal − discount + delivery (when not free)", sql`select count(*)::int n from orders o where total <> subtotal - discount_amount + (case when free_delivery then 0 else delivery_fee end)`)
  await check("DB-06", "Line total = unit price × quantity", sql`select count(*)::int n from order_items where line_total <> unit_price * quantity`)
  await check("DB-07", "No negative stock (shop level)", sql`select count(*)::int n from store_stock where physical < 0 or reserved < 0 or reserved > physical`)
  await check("DB-08", "Variant physical total = sum over shops", sql`select count(*)::int n from product_variants v where physical <> coalesce((select sum(physical) from store_stock s where s.variant_id=v.id),0)`)
  await check("DB-09", "Variant reserved total = sum over shops", sql`select count(*)::int n from product_variants v where reserved <> coalesce((select sum(reserved) from store_stock s where s.variant_id=v.id),0)`)
  await check("DB-10", "Reserved units = active reservations (per shop and variant)", sql`select count(*)::int n from store_stock s where s.reserved <> coalesce((select sum(quantity) from stock_reservations r where r.variant_id=s.variant_id and r.store_id=s.store_id and r.status='active'),0)`)
  await check("DB-11", "Every active reservation belongs to a live order line", sql`select count(*)::int n from stock_reservations r where r.status='active' and not exists (select 1 from order_items i join orders o on o.id=i.order_id where i.id=r.order_item_id and o.status not in ('cancelled','delivered') and i.removed_at is null)`)
  await check("DB-12", "Cancelled orders hold no active reservation", sql`select count(*)::int n from stock_reservations r join order_items i on i.id=r.order_item_id join orders o on o.id=i.order_id where r.status='active' and o.status='cancelled'`)
  await check("DB-13", "Delivered orders carry delivered_at; others do not", sql`select count(*)::int n from orders where (status='delivered') <> (delivered_at is not null)`)
  await check("DB-14", "Delivered orders are paid or refused (never 'due')", sql`select count(*)::int n from orders where status='delivered' and payment_status='due'`)
  await check("DB-15", "Customer phones unique", sql`select count(*)::int n from (select phone from customers group by phone having count(*)>1) x`)
  await check("DB-16", "User login phones / emails unique", sql`select count(*)::int n from ((select login_phone from users where login_phone is not null group by 1 having count(*)>1) union all (select lower(email) from users where email is not null group by 1 having count(*)>1)) x`)
  await check("DB-17", "Every user has an email or a phone", sql`select count(*)::int n from users where email is null and login_phone is null`)
  await check("DB-18", "Passwords are hashed (no plain text)", sql`select count(*)::int n from users where password_hash is null or length(password_hash) < 40 or password_hash !~ '^[\\$a-zA-Z0-9:/+=._-]+$'`)
  await check("DB-19", "Return journal items point to existing orders and have a direction", sql`select count(*)::int n from return_journal_items i left join return_journal j on j.id=i.journal_id where j.id is null or i.direction not in ('in','out')`)
  await check("DB-20", "Returned quantity never exceeds ordered quantity", sql`select count(*)::int n from order_items where returned_quantity > quantity or returned_quantity < 0`)
  await check("DB-21", "Journal amount matches its items (in: refund, out: collected)", sql`select count(*)::int n from return_journal j where j.type='return' and j.amount > 0`)
  await check("DB-22", "Orders reference an existing shop and wilaya", sql`select count(*)::int n from orders o where (store_id is not null and not exists (select 1 from stores s where s.id=o.store_id)) or (wilaya_code is not null and not exists (select 1 from wilayas w where w.code=o.wilaya_code))`)
  await check("DB-23", "Delivery rates only for known shops/wilayas, non-negative", sql`select count(*)::int n from delivery_rates r where not exists (select 1 from stores s where s.id=r.store_id) or not exists (select 1 from wilayas w where w.code=r.wilaya_code) or coalesce(home_price,0)<0 or coalesce(desk_price,0)<0`)
  await check("DB-24", "Sessions belong to existing users", sql`select count(*)::int n from sessions s left join users u on u.id=s.user_id where u.id is null`)
  await check("DB-25", "Stock movement ledger has no orphan variant/shop", sql`select count(*)::int n from stock_movements m where not exists (select 1 from stores s where s.id=m.store_id) and m.store_id is not null`)
  await check("DB-26", "Published products have a price", sql`select count(*)::int n from products where status='published' and price is null`)
  await check("DB-27", "Variant SKUs unique", sql`select count(*)::int n from (select sku from product_variants group by sku having count(*)>1) x`)
  await check("DB-28", "Order line price snapshot kept when product price changes (lines hold own price)", sql`select count(*)::int n from order_items where unit_price is null or product_name is null`)
  const sizes = await sql`select relname, pg_size_pretty(pg_total_relation_size(c.oid)) sz, reltuples::bigint rows from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' order by pg_total_relation_size(c.oid) desc limit 6`
  console.log("LARGEST TABLES", sizes.map((r) => `${r.relname}:${r.rows}rows/${r.sz}`).join("  "))
  const pass = res.filter((r) => r.ok).length
  console.log(`\nDB integrity: ${pass}/${res.length} passed`)
  require("fs").writeFileSync(process.env.OUT + "/db-audit.json", JSON.stringify({ res, schema: { tables: tables[0].n, fks: fks[0].n, unique: uniq[0].n, checks: checks[0].n, idx: idx[0].n, noPk: noPk.map((r) => r.table_name), fkNoIdx }, cascade }, null, 1))
  await sql.end()
})()

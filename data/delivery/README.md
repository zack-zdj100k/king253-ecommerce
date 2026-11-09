# Delivery price lists

Fill these from the couriers' PDF lists (one file per kind, all shops in the same file),
then import them in **Admin → Delivery → Import CSV**, or from a terminal:

```bash
node --env-file=.env.local scripts/import-delivery.mjs rates data/delivery/rates.csv
node --env-file=.env.local scripts/import-delivery.mjs desks data/delivery/desks.csv
```

- `shop` = the shop's short code from Admin → Shops (`annaba`, `constantine`, …).
- `wilaya` = code (`16`), `16 - Alger`, French or Arabic name. 69 wilayas (2026 list).
- Prices in whole DA. Empty `home_price` / `desk_price` = not offered (home: "confirmed by phone").
- A desk's own `desk_price` overrides the wilaya's desk price; leave it empty to use the wilaya's.
- Comma or semicolon separated (Excel in French saves with `;`). The first line is the header.
- Re-importing updates existing rows; nothing is deleted. Any wrong line → nothing is imported.

`*.example.csv` show the format with made-up rows. Copy them to `rates.csv` / `desks.csv`.

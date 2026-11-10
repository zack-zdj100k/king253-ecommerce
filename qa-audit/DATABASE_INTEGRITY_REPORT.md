# Database integrity report

Run on 2026-11-10 against the real project database (PostgreSQL, local copy with the same 20 migrations as production) by `qa-audit/automation/dbaudit.cjs`, plus the Vitest suite on a separate test database. **No data was deleted.**

## 1. Is the database design good? — direct answer

**Yes, for a shop of this size the design is sound and consistent.** What was checked and found correct:

| Area | Finding |
|---|---|
| Structure | 34 tables, **every table has a primary key**, 52 foreign keys, 48 unique indexes, 23 CHECK rules (e.g. quantity > 0, prices ≥ 0, returned ≤ ordered). |
| Orders | Each order line keeps its **own price, name, size, colour and photo** ("snapshot"), so changing a product's price later never changes old orders. Order number and idempotency key are unique (no duplicate orders). |
| Stock | Stock is stored **per shop and per size** (`store_stock`); the product-level totals are kept in the same transaction. Reservations (`stock_reservations`) and a movement ledger (`stock_movements`) explain every change. |
| Accounts | Phone and email are unique; every user has at least an email or a phone (CHECK rule). Passwords are scrypt hashes; sessions store only a SHA-256 hash. |
| Deletes | History is protected: deleting a product sets order lines to NULL (the snapshot stays) instead of deleting orders; order children cascade only from their own order. |
| Concurrency | Orders, status changes, returns and stock counts take row locks inside transactions. 25 buyers for 10 units → exactly 10 orders (Vitest). |

## 2. Integrity checks on the real data — 28 / 28 passed

| ID | Check | Result |
|---|---|---|
| DB-01 | No order line without an order | PASS |
| DB-02 | No order without lines | PASS |
| DB-03 | Order numbers unique | PASS |
| DB-04 | Order subtotal = sum of live original lines | PASS |
| DB-05 | Total = subtotal − discount + delivery (when not free) | PASS |
| DB-06 | Line total = unit price × quantity | PASS |
| DB-07 | No negative stock, reserved never above physical | PASS |
| DB-08 | Variant physical total = sum over shops | PASS |
| DB-09 | Variant reserved total = sum over shops | PASS |
| DB-10 | Reserved units = active reservations (per shop and size) | PASS |
| DB-11 | Every active reservation belongs to a live order line | PASS |
| DB-12 | Cancelled orders hold no reservation | PASS |
| DB-13 | `delivered_at` set exactly on delivered orders | PASS |
| DB-14 | Delivered orders are paid or refused, never "due" | PASS |
| DB-15 | Customer phones unique | PASS |
| DB-16 | User phones / emails unique | PASS |
| DB-17 | Every user has an email or a phone | PASS |
| DB-18 | Passwords hashed | PASS |
| DB-19 | Return-journal items valid | PASS |
| DB-20 | Returned quantity ≤ ordered | PASS |
| DB-21 | A "return" never has a positive amount | PASS |
| DB-22 | Orders point to existing shops and wilayas | PASS |
| DB-23 | Delivery rates valid and non-negative | PASS |
| DB-24 | No orphan sessions | PASS |
| DB-25 | Ledger has no orphan shop | PASS |
| DB-26 | Published products have a price | PASS |
| DB-27 | SKUs unique | PASS |
| DB-28 | Price snapshots present on every order line | PASS |

## 3. What the audit improved

| # | Finding | Severity | Action |
|---|---|---|---|
| DB-F1 | **27 foreign-key columns had no index** (e.g. `orders.store_id`, `orders.user_id`, `order_items.variant_id`, `return_journal.store_id`). Harmless with 50 orders; slow joins/deletes once there are many thousands. | MEDIUM (future) | **Migration 0019 adds 12 indexes** (79 → 91 indexes). Applied locally; applies automatically at the next deploy. |
| DB-F2 | A shop switched off for a product used to need its stock at 0 and **deleted** the stock rows | MEDIUM (data loss risk) | **Migration 0017**: `product_stores.active` flag — stock is kept, selling stops. |
| DB-F3 | Opening stock could land in a different shop than the one shown in the picker | HIGH (wrong stock) | Fixed in code (what you see is what is sent). |
| DB-F4 | Test data from the audit remains in the local database only (orders, accounts named "Test …", "Double Clic …", "Client Fidele …"). Production is untouched. | INFORMATIONAL | Nothing to do. |

## 4. Remaining recommendations (not blocking)

1. **Order totals as stored columns** (`subtotal`, `discount_amount`, `total`) are recalculated by code, and a CHECK rule could enforce `total = subtotal − discount + fee`. Today the checks DB-04/05 pass; adding the rule would make it impossible to break.
2. **`orders.status` + `payment_status`** together describe "returned"; consider a dedicated status in the enum if reporting grows.
3. **Archive** old `analytics_events` / `audit_logs` yearly (they only grow).
4. **Backups**: daily `pg_dump` (kept forever) is in place; **a restore test has not been done** — do one on a spare database before relying on it.
5. Production is **PostgreSQL 13**, local tests ran on 17: all new migrations use only standard SQL and apply cleanly on 13 (earlier ones were verified on the host). Check `migrate.log` after each deploy.

## 5. Not tested (BLOCKED)

* Database connection failure and recovery (needs stopping the production database; refused as destructive).
* Restore from a dump (needs a spare database).

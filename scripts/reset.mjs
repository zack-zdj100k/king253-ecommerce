// DEVELOPMENT ONLY — wipes the local database and re-applies migrations + seed.
import { execSync } from "node:child_process"

import postgres from "postgres"

import { assertLocalDatabase } from "./local-only.mjs"

assertLocalDatabase(process.env.DATABASE_URL)
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })
await sql`drop schema public cascade`
await sql`drop schema if exists drizzle cascade`
await sql`create schema public`
await sql.end()
execSync("node --env-file=.env.local scripts/migrate.mjs", { stdio: "inherit" })
execSync("node --env-file=.env.local scripts/seed.mjs", { stdio: "inherit" })

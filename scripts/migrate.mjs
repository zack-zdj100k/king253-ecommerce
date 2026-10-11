// Applies pending SQL migrations from ./drizzle to DATABASE_URL (or the URL given as argv[2]).
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

const url = process.argv[2] ?? process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

const client = postgres(url, { max: 1, onnotice: () => {} })
await migrate(drizzle(client), { migrationsFolder: "./drizzle" })
await client.end()
console.log("Migrations applied.")

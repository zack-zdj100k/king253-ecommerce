import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

/** Migrates the dedicated test database once per run. Never points at DATABASE_URL. */
export default async function setup() {
  config({ path: ".env.local" })
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error("TEST_DATABASE_URL is not set")
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL — tests wipe it.")
  const client = postgres(url, { max: 1, onnotice: () => {} })
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" })
  await client.end()
}

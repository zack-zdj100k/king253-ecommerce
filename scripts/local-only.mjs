/** Refuse to touch anything that is not a local development database. */
export function assertLocalDatabase(url) {
  if (!url) throw new Error("DATABASE_URL is not set")
  const host = new URL(url).hostname
  if (!["localhost", "127.0.0.1", "::1"].includes(host) || process.env.NODE_ENV === "production") {
    console.error(`Refusing to run: ${host} is not a local development database.`)
    process.exit(1)
  }
}

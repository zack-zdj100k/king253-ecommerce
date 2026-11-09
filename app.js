// Passenger startup file for DZSecurity (cPanel → Setup Node.js App → "Application startup file").
// 1. Applies pending database migrations (idempotent; output goes to migrate.log).
// 2. Starts the Next.js standalone server built by `npm run package:dzsecurity`.
// Passenger hooks `listen()`, so the port Next picks is replaced by Passenger's own socket.
// Secrets come from the `.env` file next to this one (loaded by Next at startup).
const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

process.env.NODE_ENV = "production"
process.env.HOSTNAME = "127.0.0.1"

const envFile = path.join(__dirname, ".env")
if (fs.existsSync(envFile)) {
  const run = spawnSync(process.execPath, [`--env-file=${envFile}`, "scripts/migrate.mjs"], {
    cwd: __dirname,
    encoding: "utf8",
    timeout: 120_000,
  })
  const log = `[${new Date().toISOString()}] exit=${run.status}\n${run.stdout ?? ""}${run.stderr ?? ""}${run.error ? String(run.error) + "\n" : ""}`
  fs.appendFileSync(path.join(__dirname, "migrate.log"), log)
}

require("./server.js")

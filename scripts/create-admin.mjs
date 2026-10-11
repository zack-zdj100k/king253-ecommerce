// Usage: npm run admin:create -- you@example.com "Your Name"
// The password is read from ADMIN_PASSWORD or asked interactively.
import { randomBytes, scrypt } from "node:crypto"
import { createInterface } from "node:readline/promises"

import postgres from "postgres"

const [email, name] = process.argv.slice(2)
if (!email || !name) {
  console.error('Usage: npm run admin:create -- you@example.com "Your Name"')
  process.exit(1)
}
let password = process.env.ADMIN_PASSWORD
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  password = await rl.question("Password (min 10 chars, letters + a number): ")
  rl.close()
}
if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
  console.error("Password must be at least 10 characters with letters and a number.")
  process.exit(1)
}

const salt = randomBytes(16)
const key = await new Promise((res, rej) =>
  scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k)))
)
const hash = ["scrypt", 16384, 8, 1, salt.toString("base64"), key.toString("base64")].join("$")

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })
const [user] = await sql`
  insert into users (email, name, password_hash, role) values (${email.toLowerCase()}, ${name}, ${hash}, 'admin')
  on conflict ((lower(email))) do update set password_hash = excluded.password_hash, role = 'admin', name = excluded.name
  returning id, email`
await sql.end()
console.log(`Admin ready: ${user.email}`)

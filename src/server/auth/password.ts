import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto"

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)))
  )

const N = 16384
const r = 8
const p = 1
const KEYLEN = 64

/** Format: scrypt$N$r$p$saltB64$hashB64 */
export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 })
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$")
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, n, rr, pp, saltB64, hashB64] = stored.split("$")
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, "base64")
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
    maxmem: 64 * 1024 * 1024,
  })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

/** Used when no user matches, so response time does not reveal which emails exist. */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64")

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters."
  if (password.length > 200) return "That password is too long."
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Use letters and at least one number."
  return null
}

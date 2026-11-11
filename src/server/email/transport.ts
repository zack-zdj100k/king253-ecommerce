import nodemailer, { type Transporter } from "nodemailer"

let cached: Transporter | null | undefined

/** SMTP transport from env, or null when SMTP is not configured. */
export function getTransport(): Transporter | null {
  if (cached !== undefined) return cached
  const host = process.env.SMTP_HOST
  if (!host) return (cached = null)
  const port = Number(process.env.SMTP_PORT || 587)
  // The host's own mail server reached on this machine (cPanel: outgoing SMTP to other servers is blocked).
  // Its certificate is issued for the mail domain, not "localhost"; the connection never leaves the server.
  const loopback = host === "localhost" || host === "127.0.0.1"
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 15_000,
    ...(loopback ? { tls: { rejectUnauthorized: false } } : {}),
  })
  return cached
}

export function fromAddress(brandName: string) {
  return process.env.SMTP_FROM || (process.env.SMTP_USER ? `${brandName} <${process.env.SMTP_USER}>` : `${brandName} <no-reply@localhost>`)
}

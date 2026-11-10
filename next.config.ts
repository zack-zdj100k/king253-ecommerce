import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const securityHeaders = [
  // Browsers remember to use HTTPS only (1 year). No includeSubDomains: mail.* and other host subdomains are not ours to force.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation=(self): the Location page's "Find the closest shop" asks for it (own pages only).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
]

const nextConfig: NextConfig = {
  // Production runs on DZSecurity (cPanel + Passenger): `next build` emits a
  // self-contained server in .next/standalone that `app.js` starts.
  output: "standalone",
  // Do not advertise the framework in every response.
  poweredByHeader: false,
  // Development only: lets the site be opened at 127.0.0.1 as well as localhost
  // (useful to test as a signed-out visitor, since cookies are per host).
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Next 16 only allows quality 75 by default; campaign imagery uses 90.
    qualities: [75, 90],
    // Resized campaign/product images stay cached 30 days (default 4 hours), so the
    // 1-CPU server rarely has to resize the same image again.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // /ar/…, /fr/…, /en/… serve the unprefixed page (src/proxy.ts sets the language first).
  // Done here, not with a rewrite in the proxy: behind cPanel's Passenger the proxy sees
  // https://localhost:3000 as the request origin, so an absolute rewrite became an
  // external fetch to that address and failed (HTTP 500).
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/:locale(ar|fr|en)", destination: "/" },
        { source: "/:locale(ar|fr|en)/:path*", destination: "/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default withNextIntl(nextConfig)

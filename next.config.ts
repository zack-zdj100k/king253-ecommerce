import type { NextConfig } from "next"

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation=(self): the Location page's "Find the closest shop" asks for it (own pages only).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
]

const nextConfig: NextConfig = {
  // Development only: lets the site be opened at 127.0.0.1 as well as localhost
  // (useful to test as a signed-out visitor, since cookies are per host).
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Next 16 only allows quality 75 by default; campaign imagery uses 90.
    qualities: [75, 90],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig

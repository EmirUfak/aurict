import type { NextConfig } from "next"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")
const appRoot = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(appRoot, "../..")

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
  turbopack: {
    root: workspaceRoot,
  },

  // aurict.dev → aurict.com kalıcı yönlendirme
  async redirects() {
    return [
      {
        source:      "/:path*",
        has:         [{ type: "host", value: "www.aurict.com" }],
        destination: "https://aurict.com/:path*",
        permanent:   true,
      },
      {
        source:      "/:path*",
        has:         [{ type: "host", value: "aurict.dev" }],
        destination: "https://aurict.com/:path*",
        permanent:   true,
      },
      {
        source:      "/:path*",
        has:         [{ type: "host", value: "www.aurict.dev" }],
        destination: "https://aurict.com/:path*",
        permanent:   true,
      },
      {
        source: "/claude-code-alternative",
        destination: "/compare/claude-code",
        permanent: true,
      },
      {
        source: "/terminal-ai",
        destination: "/terminal-agent",
        permanent: true,
      },
      {
        source: "/coding-agent",
        destination: "/ai-coding-agent",
        permanent: true,
      },
      {
        source: "/ai-agent",
        destination: "/ai-coding-agent",
        permanent: true,
      },
    ]
  },

  // Güvenlik header'ları (SEO trust signals için)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-XSS-Protection",       value: "1; mode=block" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)

import type { MetadataRoute } from "next"
import { SUPPORTED_LOCALES } from "@/i18n/config"

const privateRoutes = ["/auth/", "/console", "/login", "/register"]
const localizedPrivateRoutes = SUPPORTED_LOCALES
  .filter((locale) => locale !== "en")
  .flatMap((locale) => privateRoutes.map((path) => `/${locale}${path}`))

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow:     "/",
        disallow:  ["/api/", ...privateRoutes, ...localizedPrivateRoutes],
      },
    ],
    sitemap: "https://aurict.com/sitemap.xml",
    host:    "https://aurict.com",
  }
}

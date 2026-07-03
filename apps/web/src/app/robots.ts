import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow:     "/",
        disallow:  ["/api/", "/auth/", "/console/", "/login", "/register"],
      },
    ],
    sitemap: "https://aurict.com/sitemap.xml",
    host:    "https://aurict.com",
  }
}

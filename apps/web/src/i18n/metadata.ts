import type { Metadata } from "next"
import type { AppLocale } from "./routing"

const siteUrl = "https://aurict.com"

export function localizedUrl(path: string, locale: AppLocale) {
  const normalizedPath = path === "/" ? "" : path
  return `${siteUrl}${locale === "tr" ? "/tr" : ""}${normalizedPath}`
}

export function localizedMetadata(locale: AppLocale, path: string, title: string, description: string): Metadata {
  const url = localizedUrl(path, locale)

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: localizedUrl(path, "en"),
        tr: localizedUrl(path, "tr"),
        "x-default": localizedUrl(path, "en"),
      },
    },
    openGraph: { title, description, url, locale: locale === "tr" ? "tr_TR" : "en_US" },
  }
}

export const SUPPORTED_LOCALES = ["en", "tr", "de", "fr", "es"] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = "en"

export const LOCALE_DETAILS: Record<AppLocale, {
  hrefLang: string
  openGraphLocale: string
}> = {
  en: { hrefLang: "en", openGraphLocale: "en_US" },
  tr: { hrefLang: "tr", openGraphLocale: "tr_TR" },
  de: { hrefLang: "de", openGraphLocale: "de_DE" },
  fr: { hrefLang: "fr", openGraphLocale: "fr_FR" },
  es: { hrefLang: "es", openGraphLocale: "es_ES" },
}

export function isAppLocale(value: string | undefined): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
}

export function localePrefix(locale: AppLocale) {
  return locale === DEFAULT_LOCALE ? "" : `/${locale}`
}

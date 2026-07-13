import { getRequestConfig } from "next-intl/server"
import { routing, type AppLocale } from "./routing"

function resolveLocale(value: string | undefined): AppLocale {
  return routing.locales.includes(value as AppLocale) ? value as AppLocale : routing.defaultLocale
}

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale(await requestLocale)
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})

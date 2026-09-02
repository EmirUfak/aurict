import { getRequestConfig } from "next-intl/server"
import { routing, type AppLocale } from "./routing"
import { isAppLocale } from "./config"

function resolveLocale(value: string | undefined): AppLocale {
  return isAppLocale(value) ? value : routing.defaultLocale
}

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale(await requestLocale)
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})

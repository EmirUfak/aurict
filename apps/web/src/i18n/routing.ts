import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["en", "tr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: {
    name: "AURICT_LOCALE",
    sameSite: "lax",
  },
})

export type AppLocale = (typeof routing.locales)[number]

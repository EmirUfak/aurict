"use client"

import { useLocale, useTranslations } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { SUPPORTED_LOCALES, type AppLocale } from "@/i18n/config"

const locales = SUPPORTED_LOCALES

export function LocaleSwitcher() {
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("Locale")

  return (
    <label className="locale-switcher">
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        onChange={(event) => {
          const nextLocale = event.target.value as AppLocale
          document.cookie = `AURICT_LOCALE=${nextLocale}; Path=/; SameSite=Lax`
          router.replace(pathname, { locale: nextLocale })
          router.refresh()
        }}
        value={locale}
      >
        {locales.map((option) => <option key={option} value={option}>{t(option)}</option>)}
      </select>
    </label>
  )
}

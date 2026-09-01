import type { Metadata } from "next"
import { AurictLandingExact } from "@/components/landing/AurictLandingExact"
import { JsonLd } from "@/components/seo/JsonLd"
import { getLocale } from "next-intl/server"
import type { AppLocale } from "@/i18n/routing"
import { localizedMetadata } from "@/i18n/metadata"
import { SUPPORTED_LOCALES } from "@/i18n/config"
import { homeStructuredData, localizeHomeSeo } from "@/content/home-seo"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale() as AppLocale
  const seo = localizeHomeSeo(locale)
  return localizedMetadata(
    locale,
    "/",
    seo.title,
    seo.description,
    { keywords: seo.keywords, translatedLocales: SUPPORTED_LOCALES },
  )
}

export default async function Home() {
  const locale = await getLocale() as AppLocale

  return (
    <>
      <JsonLd data={homeStructuredData(locale)} />
      <AurictLandingExact />
    </>
  )
}

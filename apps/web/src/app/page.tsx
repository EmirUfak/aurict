import type { Metadata } from "next"
import { AurictLandingExact } from "@/components/landing/AurictLandingExact"
import { getLocale } from "next-intl/server"
import type { AppLocale } from "@/i18n/routing"
import { localizedMetadata } from "@/i18n/metadata"
import { localizeFaqJsonLd, localizeHowToJsonLd, localizeHomeJsonLd } from "@/content/home-translations"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale() as AppLocale
  return localizedMetadata(
    locale,
    "/",
    locale === "tr" ? "Aurict — Terminal tabanlı yapay zeka kodlama asistanı" : "Aurict — Terminal-native AI coding assistant",
    locale === "tr"
      ? "Çoklu ajan kodlama, MCP, yerel bağlam ve açık onaylar için açık kaynaklı terminal çalışma zamanı. Aurict ayrıca Hoprel masaüstü çalışma alanını, Aurict Mobile'ı ve sabit getirili piyasa zekâsı ürünü Bondley.one'ı sunar."
      : "Open-source terminal runtime for multi-agent coding, MCP, local context, and explicit approvals. Aurict also ships Hoprel desktop, Aurict Mobile, and Bondley.one fixed-income intelligence.",
  )
}

export default async function Home() {
  const locale = await getLocale() as AppLocale
  const jsonLd = localizeHomeJsonLd(locale)
  const faqJsonLd = localizeFaqJsonLd(locale)
  const howToJsonLd = localizeHowToJsonLd(locale)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <AurictLandingExact />
    </>
  )
}

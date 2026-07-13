import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import type { AppLocale } from "@/i18n/routing"
import { localizedMetadata } from "@/i18n/metadata"

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale
  return {
    ...localizedMetadata(
      locale,
      "/console",
      locale === "tr" ? "Konsol" : "Console",
      locale === "tr" ? "Aurict kontrol paneli." : "The Aurict console.",
    ),
    robots: { index: false, follow: false },
  }
}

export default function ConsolePage() {
  redirect("/console/account")
}

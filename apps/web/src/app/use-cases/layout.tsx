import type { Metadata } from "next"
import { getLocale } from "next-intl/server"
import { localizedMetadata } from "@/i18n/metadata"
import type { AppLocale } from "@/i18n/routing"

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale
  const title =
    locale === "tr"
      ? "Kullanım Alanları — Yapay Zeka Destekli Geliştirme Akışları"
      : "Use Cases — AI-Powered Development Workflows"
  const description =
    locale === "tr"
      ? "Aurict'in uzman ajanlarının yeniden düzenleme, kod incelemesi, test, dokümantasyon ve daha fazlasını nasıl ele aldığını keşfet. Yapay zeka destekli geliştirmenin gerçek örneklerini gör."
      : "Discover how Aurict's specialist agents handle refactoring, code review, testing, documentation, and more. See real-world examples of AI-assisted development."
  return localizedMetadata(locale, "/use-cases", title, description)
}

export default function UseCasesLayout({ children }: { children: React.ReactNode }) {
  return children
}

import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthForm } from "@/components/auth/AuthForm"
import { getLocale } from "next-intl/server"
import type { AppLocale } from "@/i18n/routing"
import { localizedMetadata } from "@/i18n/metadata"

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale
  return {
    ...localizedMetadata(
      locale,
      "/login",
      locale === "tr" ? "Giriş yap" : "Sign in",
      locale === "tr" ? "Aurict hesabınıza giriş yapın." : "Sign in to your Aurict account.",
    ),
    robots: { index: false, follow: false },
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-shell" />}>
      <AuthForm mode="login" />
    </Suspense>
  )
}

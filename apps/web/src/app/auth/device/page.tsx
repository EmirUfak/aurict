import type { Metadata } from "next"
import { Suspense } from "react"
import { getLocale } from "next-intl/server"
import { localizedMetadata } from "@/i18n/metadata"
import type { AppLocale } from "@/i18n/routing"
import { DeviceLogin } from "@/components/auth/DeviceLogin"

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale
  const base = localizedMetadata(
    locale,
    "/auth/device",
    locale === "tr" ? "CLI tarayıcı girişi" : "CLI browser login",
    locale === "tr"
      ? "Bir Aurict CLI tarayıcı giriş isteğini yetkilendir."
      : "Authorize an Aurict CLI browser login request.",
  )
  return { ...base, robots: { index: false, follow: false } }
}

export default function DeviceLoginPage() {
  return (
    <Suspense fallback={<div className="auth-shell" />}>
      <DeviceLogin />
    </Suspense>
  )
}

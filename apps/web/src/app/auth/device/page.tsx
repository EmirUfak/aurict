import type { Metadata } from "next"
import { Suspense } from "react"
import { DeviceLogin } from "@/components/auth/DeviceLogin"

export const metadata: Metadata = {
  title: "CLI browser login",
  description: "Authorize an Aurict CLI browser login request.",
  alternates: { canonical: "https://aurict.com/auth/device" },
  robots: { index: false, follow: false },
}

export default function DeviceLoginPage() {
  return (
    <Suspense fallback={<div className="auth-shell" />}>
      <DeviceLogin />
    </Suspense>
  )
}

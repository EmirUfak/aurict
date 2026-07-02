import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthForm } from "@/components/auth/AuthForm"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Aurict account.",
  alternates: { canonical: "https://aurict.com/login" },
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-shell" />}>
      <AuthForm mode="login" />
    </Suspense>
  )
}

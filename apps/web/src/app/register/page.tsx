import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthForm } from "@/components/auth/AuthForm"

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Aurict account for web, mobile, and CLI browser login.",
  alternates: { canonical: "https://aurict.com/register" },
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="auth-shell" />}>
      <AuthForm mode="register" />
    </Suspense>
  )
}

import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Console",
  robots: { index: false, follow: false },
}

export default function ConsolePage() {
  redirect("/console/account")
}

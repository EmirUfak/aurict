import type { Metadata } from "next"
import { AccountConsole } from "@/components/console/AccountConsole"

export const metadata: Metadata = {
  title: "Account Console",
  description: "Manage your Aurict account.",
  alternates: { canonical: "https://aurict.com/console/account" },
  robots: { index: false, follow: false },
}

export default function AccountConsolePage() {
  return <AccountConsole />
}

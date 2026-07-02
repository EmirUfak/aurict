import type { Metadata } from "next"
import { IntroPreviewClient } from "@/components/IntroPreviewClient"

export const metadata: Metadata = {
  title: "Intro Preview — Aurict",
  robots: {
    index:  false,
    follow: false,
  },
}

export default function IntroPreviewPage() {
  return <IntroPreviewClient />
}

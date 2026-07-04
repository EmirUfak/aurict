import type { Metadata } from "next"
import { CursorGate } from "@/components/ui/CursorGate"

export const metadata: Metadata = {
  title: "Cursor",
  robots: { index: false, follow: false },
}

export default function CursorPage() {
  return <CursorGate />
}

import type { Metadata } from "next"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/sections/Footer"
import { Breadcrumb } from "@/components/ui/Breadcrumb"
import { CompareCard } from "@/components/ui/CompareCard"
import { COMPARISONS } from "@/content/comparisons"
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Aurict vs. Alternatives — Terminal AI Coding Assistant Comparisons",
  description: "See how Aurict compares to Claude Code, Cursor, Aider, GitHub Copilot, and OpenCode. Multi-provider, multi-agent, native binary.",
  alternates: { canonical: "https://aurict.com/compare" },
}

const breadcrumb = breadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "Compare", path: "/compare" },
])

const collection = collectionJsonLd({
  name: "Aurict Alternatives and Comparisons",
  description: "Compare Aurict with Claude Code, Cursor, Aider, GitHub Copilot, and OpenCode.",
  path: "/compare",
  items: COMPARISONS.map((comparison) => ({
    name: comparison.title,
    path: `/compare/${comparison.slug}`,
    description: comparison.description,
  })),
})

export default function ComparePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      <Nav />
      <main className="marketing-main" style={{ maxWidth: 900 }}>
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Compare", href: "/compare" }]} />

        <div className="marketing-hero" style={{ marginTop: 24 }}>
          <p className="marketing-eyebrow">Comparisons</p>
          <h1 className="marketing-title marketing-title-sm">Aurict vs. the alternatives</h1>
          <p className="marketing-lede">
            How does Aurict compare to other AI coding tools? Here&apos;s an honest look at where it wins, where competitors have their strengths, and which tool fits which workflow.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {COMPARISONS.map((c) => (
            <CompareCard key={c.slug} {...c} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}

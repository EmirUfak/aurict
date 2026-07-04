import Link from "next/link"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/sections/Footer"
import { Breadcrumb } from "@/components/ui/Breadcrumb"
import { USE_CASES } from "@/content/use-cases"
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo"

const breadcrumb = breadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "Use Cases", path: "/use-cases" },
])

const collection = collectionJsonLd({
  name: "Aurict Use Cases",
  description: "Practical AI-powered development workflows for terminal-native coding.",
  path: "/use-cases",
  items: USE_CASES.map((useCase) => ({
    name: useCase.title,
    path: `/use-cases/${useCase.slug}`,
    description: useCase.description,
  })),
})

export default function UseCasesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      <Nav />
      <main style={{ margin: "0 auto", maxWidth: 900, padding: "100px 24px 80px" }}>
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Use Cases", href: "/use-cases" },
          ]}
        />

        <div style={{ marginBottom: 60 }}>
          <p className="marketing-eyebrow">Use cases</p>
          <h1 className="marketing-title marketing-title-sm">What can Aurict do?</h1>
          <p className="marketing-lede" style={{ maxWidth: 620 }}>
            See how Aurict&apos;s specialist agents handle real-world development tasks in a terminal-native workflow.
          </p>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {USE_CASES.map((useCase) => (
            <Link
              key={useCase.slug}
              href={`/use-cases/${useCase.slug}`}
              className="marketing-card"
              style={{ display: "block", padding: "28px", textDecoration: "none" }}
            >
              <div className="mono" style={{ color: "var(--accent)", fontSize: 12, marginBottom: 16 }}>{useCase.icon}</div>
              <h2 style={{ color: "var(--text)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 8 }}>
                {useCase.title}
              </h2>
              <span className="marketing-tag" style={{ marginBottom: 12 }}>{useCase.agent}</span>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>
                {useCase.description}
              </p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}

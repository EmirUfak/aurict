import { Nav } from "@/components/Nav"
import { Footer } from "@/components/sections/Footer"
import { getChangelog } from "@/lib/changelog"
import type { Metadata } from "next"

export const revalidate = 1800

export const metadata: Metadata = {
  title:       "Changelog — Release History",
  description: "Aurict version history and release notes, synced automatically from GitHub Releases.",
  alternates:  { canonical: "https://aurict.com/changelog" },
  openGraph: {
    title:       "Aurict Changelog — Release History",
    description: "Version history and release notes for Aurict, the open-source terminal AI coding assistant.",
    url:         "https://aurict.com/changelog",
  },
}

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type":    "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home",      "item": "https://aurict.com" },
    { "@type": "ListItem", "position": 2, "name": "Changelog", "item": "https://aurict.com/changelog" },
  ],
}

const TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  new:  { label: "New",  color: "#4eba65", bg: "rgba(78,186,101,0.1)" },
  fix:  { label: "Fix",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  break: { label: "Breaking", color: "#ff6b6b", bg: "rgba(255,107,107,0.1)" },
  perf: { label: "Perf", color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
}

export default async function ChangelogPage() {
  const changelog = await getChangelog()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Nav />
      <main className="marketing-main marketing-main-narrow">
        <div className="marketing-hero">
          <p className="marketing-eyebrow">Changelog</p>
          <h1 className="marketing-title marketing-title-sm">Release history</h1>
          <p className="marketing-lede">Every meaningful change to Aurict, synced from GitHub Releases.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 56, borderLeft: "1px solid var(--border)", paddingLeft: 32 }}>
          {changelog.map((release) => (
            <div key={release.version} style={{ position: "relative" }}>
              <span className="changelog-dot" />
              {/* version header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 28,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--text)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  v{release.version}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: release.tagColor,
                    background: "color-mix(in oklch, var(--accent) 12%, transparent)",
                    border: "1px solid color-mix(in oklch, var(--accent) 28%, transparent)",
                    borderRadius: 4,
                    padding: "3px 9px",
                  }}
                >
                  {release.tag}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginLeft: "auto",
                  }}
                >
                  {release.date}
                </span>
              </div>

              {/* changes */}
              <div
                className="marketing-card"
                style={{
                  overflow: "hidden",
                }}
              >
                {release.changes.map((change, i) => {
                  const style = TYPE_STYLE[change.type] ?? TYPE_STYLE.new
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 14,
                        padding: "14px 20px",
                        borderBottom: i < release.changes.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: style.color,
                          background: style.bg,
                          borderRadius: 4,
                          padding: "2px 7px",
                          marginTop: 1,
                          flexShrink: 0,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {style.label}
                      </span>
                      <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--text-dim)", lineHeight: 1.62 }}>
                        {change.text}
                      </p>
                    </div>
                  )
                })}
              </div>
              {release.url && (
                <a
                  className="mono dim-link"
                  href={release.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  style={{ display: "inline-flex", fontSize: 12, marginTop: 12 }}
                >
                  view release on GitHub
                </a>
              )}
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}

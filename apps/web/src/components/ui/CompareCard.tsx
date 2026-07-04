"use client"
import Link from "next/link"

interface CompareCardProps {
  slug: string
  competitor: string
  tagline: string
  description: string
  differentiator: string
}

export function CompareCard({ slug, competitor, tagline, description, differentiator }: CompareCardProps) {
  return (
    <Link href={`/compare/${slug}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          padding: "28px 32px",
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "linear-gradient(135deg, rgba(56,189,248,0.035), var(--bg-card))",
          transition: "border-color 0.2s, transform 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = "var(--accent-blue)"
          el.style.transform = "translateY(-2px)"
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = "var(--border)"
          el.style.transform = "translateY(0)"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                Aurict vs {competitor}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-geist-mono)",
                  color: "var(--accent-blue)",
                  background: "rgba(56,189,248,0.09)",
                  border: "1px solid rgba(56,189,248,0.2)",
                  borderRadius: 6,
                  padding: "3px 9px",
                  whiteSpace: "nowrap",
                }}
              >
                {differentiator}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, fontStyle: "italic", marginBottom: 8 }}>
              {tagline}
            </p>
            <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.6, margin: 0 }}>
              {description}
            </p>
          </div>
          <span style={{ fontSize: 20, color: "var(--accent-blue)", alignSelf: "center", flexShrink: 0 }}>
            →
          </span>
        </div>
      </div>
    </Link>
  )
}

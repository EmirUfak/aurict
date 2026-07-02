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
        className="marketing-card"
        style={{
          padding: "28px 30px",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <span className="mono aur-corner" style={{ position: "absolute", top: 8, left: 8, color: "oklch(1 0 0/.18)" }}>┌</span>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                Aurict vs {competitor}
              </h2>
              <span
                className="marketing-tag"
                style={{
                  whiteSpace: "nowrap",
                }}
              >
                {differentiator}
              </span>
            </div>
            <p className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0, marginBottom: 8 }}>
              {tagline}
            </p>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 15.5, color: "var(--text-dim)", lineHeight: 1.62, margin: 0 }}>
              {description}
            </p>
          </div>
          <span className="mono" style={{ fontSize: 20, color: "var(--accent)", alignSelf: "center", flexShrink: 0 }}>
            →
          </span>
        </div>
      </div>
    </Link>
  )
}

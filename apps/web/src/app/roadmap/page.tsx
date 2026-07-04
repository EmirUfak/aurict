import type { Metadata } from "next"
import Link from "next/link"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/sections/Footer"
import { Breadcrumb } from "@/components/ui/Breadcrumb"

export const metadata: Metadata = {
  title:       "Aurict Roadmap — Product Direction",
  description: "Aurict roadmap across the terminal agent, mobile BYOK assistant, web platform, MicroTarget.one integration, security vertical, and long-term AI research.",
  alternates:  { canonical: "https://aurict.com/roadmap" },
  openGraph: {
    title:       "Aurict Roadmap — Product Direction",
    description: "The public product direction for Aurict.",
    url:         "https://aurict.com/roadmap",
  },
}

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type":    "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home",    "item": "https://aurict.com" },
    { "@type": "ListItem", "position": 2, "name": "Roadmap", "item": "https://aurict.com/roadmap" },
  ],
}

type RoadmapStatus = "live" | "active" | "planned" | "research"

const statusStyle: Record<RoadmapStatus, { color: string; background: string; border: string }> = {
  live: {
    color:      "var(--success)",
    background: "color-mix(in oklch, var(--success) 12%, transparent)",
    border:     "color-mix(in oklch, var(--success) 30%, transparent)",
  },
  active: {
    color:      "var(--accent)",
    background: "color-mix(in oklch, var(--accent) 13%, transparent)",
    border:     "color-mix(in oklch, var(--accent) 32%, transparent)",
  },
  planned: {
    color:      "var(--warning)",
    background: "color-mix(in oklch, var(--warning) 12%, transparent)",
    border:     "color-mix(in oklch, var(--warning) 28%, transparent)",
  },
  research: {
    color:      "oklch(0.76 0.12 290)",
    background: "oklch(0.76 0.12 290 / 0.12)",
    border:     "oklch(0.76 0.12 290 / 0.28)",
  },
}

const phases = [
  {
    label: "Phase 01",
    title: "Working Core",
    status: "live" as const,
    items: [
      "Terminal-native Aurict CLI",
      "BYOK provider model",
      "Firebase-backed web auth",
      "Browser-based login for CLI sessions",
      "Mobile BYOK chat, research, and PDF generation",
      "GitHub Releases powered automatic changelog",
    ],
  },
  {
    label: "Phase 02",
    title: "Product Hardening",
    status: "active" as const,
    items: [
      "Full alignment between mobile and web brand language",
      "Real-device auth and provider key flows",
      "CLI remote approval and session management",
      "Production environment variable checks",
      "Release, changelog, and roadmap publishing discipline",
    ],
  },
  {
    label: "Phase 03",
    title: "Ecosystem Expansion",
    status: "planned" as const,
    items: [
      "MicroTarget.one dashboard and process management integration",
      "AI-assisted optimization and decision support layer",
      "Design and interface generation layer",
      "Independent platform foundation for the cybersecurity vertical",
    ],
  },
  {
    label: "Phase 04",
    title: "Research Track",
    status: "research" as const,
    items: [
      "Alternative architectural approaches for model orchestration",
      "Lower-cost inference and context strategies",
      "More accessible and more accurate LLM experiments",
      "Long-term model research fed by the Aurict ecosystem",
    ],
  },
]

const signals = [
  ["Now", "Web, CLI, and mobile are converging under one brand system."],
  ["Next", "Mobile auth, key management, and browser login flows are being hardened."],
  ["Later", "MicroTarget.one and new verticals connect into the Aurict operations brain."],
]

export default function RoadmapPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Nav />
      <main className="marketing-main" style={{ maxWidth: 1120 }}>
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Roadmap", href: "/roadmap" }]} />

        <section className="marketing-hero" style={{ marginTop: 24 }}>
          <p className="marketing-eyebrow">Public roadmap</p>
          <h1 className="marketing-title">The product route, organized into clear phases.</h1>
          <p className="marketing-lede">
            The Aurict roadmap is not just a feature list. It is a controlled progression from terminal agent to mobile BYOK assistant, from web platform to MicroTarget.one integration, and from there into long-term model research.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
            <Link className="aur-button aur-button-primary" href="/changelog">latest changes</Link>
            <Link className="aur-button aur-button-secondary" href="/about">read manifesto</Link>
          </div>
        </section>

        <section className="resp-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 42 }}>
          {signals.map(([label, body]) => (
            <article key={label} className="marketing-card" style={{ padding: 20 }}>
              <p className="mono" style={{ color: "var(--accent)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>{label}</p>
              <p style={{ color: "var(--text)", fontSize: 18, lineHeight: 1.45 }}>{body}</p>
            </article>
          ))}
        </section>

        <section style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "color-mix(in oklch, var(--bg-card) 72%, transparent)", marginBottom: 64 }}>
          <div className="resp-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(240px, 1fr))" }}>
            {phases.map((phase, index) => (
              <article
                key={phase.label}
                style={{
                  borderRight: index < phases.length - 1 ? "1px solid var(--border)" : "none",
                  minHeight:   520,
                  padding:     24,
                  position:    "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 26 }}>
                  <span className="mono" style={{ color: "var(--text-muted)", fontSize: 12 }}>{phase.label}</span>
                  <Status status={phase.status} />
                </div>
                <h2 style={{ color: "var(--text)", fontSize: 28, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.12, marginBottom: 22 }}>{phase.title}</h2>
                <div style={{ background: "linear-gradient(180deg, var(--accent), transparent)", height: 76, left: 24, opacity: 0.45, position: "absolute", top: 96, width: 1 }} />
                <ul style={{ display: "flex", flexDirection: "column", gap: 16, listStyle: "none", marginTop: 34 }}>
                  {phase.items.map((item) => (
                    <li key={item} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 12, alignItems: "start" }}>
                      <span style={{ background: "var(--accent)", borderRadius: 999, boxShadow: "0 0 0 5px color-mix(in oklch, var(--accent) 10%, transparent)", height: 6, marginTop: 8, width: 6 }} />
                      <span style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.55 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="resp-grid-2" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18, alignItems: "stretch" }}>
          <article className="marketing-card" style={{ padding: 28 }}>
            <p className="marketing-eyebrow" style={{ marginBottom: 12 }}>Roadmap policy</p>
            <h2 style={{ color: "var(--text)", fontSize: 30, fontWeight: 600, lineHeight: 1.18, marginBottom: 14 }}>This page is a direction map, not a promise list.</h2>
            <p className="marketing-copy">
              The roadmap shows where the product is going, which phases are active, and which strategic layers are waiting next. Completed work is tracked in detail through the changelog.
            </p>
          </article>
          <article className="marketing-card" style={{ padding: 28, background: "linear-gradient(180deg, color-mix(in oklch, var(--accent) 10%, var(--bg-card)), var(--bg-card))" }}>
            <p className="mono" style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 20 }}>release truth source</p>
            <Link className="aur-button aur-button-secondary" href="/changelog" style={{ width: "100%", marginBottom: 14 }}>changelog</Link>
            <Link className="aur-button aur-button-primary" href="/docs" style={{ width: "100%" }}>docs</Link>
          </article>
        </section>
      </main>
      <Footer />
    </>
  )
}

function Status({ status }: { status: RoadmapStatus }) {
  const style = statusStyle[status]
  const label = status === "live" ? "Live" : status === "active" ? "Active" : status === "planned" ? "Planned" : "Research"

  return (
    <span
      className="mono"
      style={{
        background:    style.background,
        border:        `1px solid ${style.border}`,
        borderRadius:  4,
        color:         style.color,
        fontSize:      10.5,
        letterSpacing: ".05em",
        padding:       "4px 8px",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  )
}

import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/sections/Footer"
import { Breadcrumb } from "@/components/ui/Breadcrumb"

export const metadata: Metadata = {
  title:       "About Aurict — Manifesto",
  description: "Aurict manifesto: BYOK AI orchestration, radical objectivity, lean architecture, TDD discipline, and the long-term ecosystem vision.",
  alternates:  { canonical: "https://aurict.com/about" },
  openGraph: {
    title:       "About Aurict — Manifesto",
    description: "Aurict manifesto and ecosystem direction.",
    url:         "https://aurict.com/about",
  },
}

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type":    "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home",  "item": "https://aurict.com" },
    { "@type": "ListItem", "position": 2, "name": "About", "item": "https://aurict.com/about" },
  ],
}

const principles = [
  {
    label: "01",
    title: "Architecture As Lean As Possible",
    body:  "Aurict focuses on reducing context bloat, unnecessary token spend, and distracting interface layers. The goal is an orchestration layer that moves the user toward the right result through the shortest defensible path.",
  },
  {
    label: "02",
    title: "TDD Discipline",
    body:  "Aurict puts testability and controlled change at the center. Whether writing code, managing security workflows, or producing technical decisions, it follows an engineering approach with its feet on the ground.",
  },
  {
    label: "03",
    title: "Radical Objectivity",
    body:  "Aurict is designed to say what is useful, not what is flattering. Instead of artificial praise and vague guidance, it aims for cold, clear, rational output.",
  },
]

const ecosystem = [
  {
    title: "MicroTarget.one Integration",
    body:  "MicroTarget.one is an independent project that uses on-device ML to reduce server load and make customer engagement workflows more efficient. On the Aurict side, the goal is to connect it over time to dashboarding, process management, optimization, and decision support.",
  },
  {
    title: "Visual and interface layer",
    body:  "Inside the ecosystem, Aurict aims to support a dedicated production layer where AI can generate interfaces, code components, and design systems in a live and functional way.",
  },
  {
    title: "Cybersecurity vertical",
    body:  "An independent vertical for cyber analysis, defense, penetration testing, and security workflows is positioned as a core part of the Aurict vision.",
  },
]

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Nav />
      <main className="marketing-main" style={{ maxWidth: 1040 }}>
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "About", href: "/about" }]} />

        <section className="marketing-hero" style={{ marginTop: 24 }}>
          <p className="marketing-eyebrow">Manifesto</p>
          <h1 className="marketing-title">About Aurict</h1>
          <p className="marketing-lede">
            The AI world is surrounded by high costs, inflated context, inefficient token usage, and an illusion of artificial praise that often pulls users away from rational solutions.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
            <Link className="aur-button aur-button-primary" href="/roadmap">view roadmap</Link>
            <Link className="aur-button aur-button-secondary" href="/docs">technical docs</Link>
          </div>
        </section>

        <section className="resp-grid-2" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 34, alignItems: "start", marginBottom: 64 }}>
          <article className="marketing-card" style={{ padding: 30 }}>
            <p className="marketing-copy" style={{ fontSize: 18, color: "var(--text)" }}>
              Aurict was born as an engineering answer to this inefficiency and as a radical optimization movement.
            </p>
            <p className="marketing-copy" style={{ marginTop: 18 }}>
              We treat the hardware and capital barriers of training large models from scratch not as a dead end, but as a design constraint. The aim is to build an orchestration brain that manages the strongest existing models in a smarter, more efficient, and more controlled way.
            </p>
            <p className="marketing-copy" style={{ marginTop: 18 }}>
              What started as a bootstrapped hobby project is now moving toward a more clearly defined technology ecosystem.
            </p>
          </article>

          <aside className="marketing-card" style={{ padding: 22, position: "sticky", top: 92 }}>
            <p className="mono" style={{ color: "var(--accent)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 14 }}>current signal</p>
            <div className="mono" style={{ color: "var(--text)", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>aurict<span className="aur-cursor">█</span></div>
            <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.65 }}>
              The process is active. The cursor is ready. The product is moving from terminal to mobile, and from there toward a wider AI ecosystem.
            </p>
          </aside>
        </section>

        <ManifestoSection title="What Is Aurict?">
          <p className="marketing-copy">
            Aurict is a futuristic terminal and mobile AI agent built around the BYOK model: bring your own key. It helps users manage their existing model providers with more control across coding, cybersecurity, research, document generation, and technical problem solving.
          </p>
          <p className="marketing-copy">
            The user brings the API key. Aurict turns that scattered energy into a more focused, observable, and disciplined workflow.
          </p>
        </ManifestoSection>

        <section style={{ marginBottom: 72 }}>
          <h2 className="marketing-section-title">Three Core Principles</h2>
          <div className="resp-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            {principles.map((item) => (
              <article key={item.label} className="marketing-card" style={{ padding: 22 }}>
                <span className="marketing-tag">{item.label}</span>
                <h3 style={{ color: "var(--text)", fontSize: 22, fontWeight: 600, lineHeight: 1.2, margin: "18px 0 12px" }}>{item.title}</h3>
                <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.68 }}>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <ManifestoSection title="Our Aim: Building A Multi-Layer AI Ecosystem">
          <p className="marketing-copy">
            Aurict is still early. But the direction is clear: not a single tool, but an AI ecosystem made of vertical products and platforms that strengthen each other.
          </p>
        </ManifestoSection>

        <section className="resp-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 72 }}>
          {ecosystem.map((item) => (
            <article key={item.title} className="marketing-card" style={{ padding: 22 }}>
              <h3 style={{ color: "var(--text)", fontSize: 20, fontWeight: 600, lineHeight: 1.25, marginBottom: 12 }}>{item.title}</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.68 }}>{item.body}</p>
            </article>
          ))}
        </section>

        <ManifestoSection title="The Long-Term Target: Alternative Approaches And Accessible LLMs">
          <p className="marketing-copy">
            As the Aurict ecosystem grows and earns its own financial freedom, we want to focus on one of the largest problems in AI: cost and accuracy.
          </p>
          <p className="marketing-copy">
            The long-term goal is to move beyond default industry assumptions and experiment with different architectural approaches, aiming for AI models that are more accurate, lower cost, and more accessible.
          </p>
          <p className="marketing-copy">
            In the myth, Icarus fell because he flew toward the sun with fragile wax wings. Aurict aims to rise toward the sun with wings reinforced by TDD discipline, cybersecurity armor, efficient growth engineering, and an independent ecosystem architecture.
          </p>
        </ManifestoSection>

        <section className="marketing-card" style={{ padding: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22 }}>
          <div>
            <p className="marketing-eyebrow" style={{ marginBottom: 10 }}>Direction</p>
            <h2 style={{ color: "var(--text)", fontSize: 30, fontWeight: 600, lineHeight: 1.18 }}>The manifesto lives here. The route lives in the roadmap.</h2>
          </div>
          <Link className="aur-button aur-button-primary" href="/roadmap">open roadmap</Link>
        </section>
      </main>
      <Footer />
    </>
  )
}

function ManifestoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 58 }}>
      <h2 className="marketing-section-title">{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {children}
      </div>
    </section>
  )
}

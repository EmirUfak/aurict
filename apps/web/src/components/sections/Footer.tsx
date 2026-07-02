"use client"

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "color-mix(in oklch, var(--bg-alt) 60%, transparent)" }}>
      <div className="landing-shell landing-footer">
        <div>
          <span
            className="mono"
            style={{
              display: "block",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 10,
            }}
          >
            aurict
          </span>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>AGPLv3 License · © 2026 aurict</span>
        </div>

        <div style={{ display: "flex", gap: 56, flexWrap: "wrap" }}>
          <FooterColumn title="product" links={[["capabilities", "/#capabilities"], ["roadmap", "/roadmap"], ["compare", "/compare"], ["docs", "/docs"], ["changelog", "/changelog"]]} />
          <FooterColumn title="company" links={[["about", "/about"], ["blog", "/blog"], ["use cases", "/use-cases"]]} />
          <FooterColumn title="legal" links={[["privacy", "/privacy"], ["terms", "/terms"]]} />
          <FooterColumn title="open source" links={[["GitHub", "https://github.com/aurict/aurict"], ["npm", "https://www.npmjs.com/package/aurict"]]} />
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "oklch(0.42 0.008 75)", marginBottom: 4 }}>{title}</div>
      {links.map(([label, href]) => (
        <a
          key={label}
          className="mono landing-footer-link"
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {label}
        </a>
      ))}
    </div>
  )
}

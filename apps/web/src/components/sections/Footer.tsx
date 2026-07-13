"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

export function Footer() {
  const t = useTranslations("Footer")

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
          <FooterColumn title={t("product")} links={[[t("capabilities"), "/#capabilities"], [t("roadmap"), "/roadmap"], [t("compare"), "/compare"], [t("docs"), "/docs"], [t("changelog"), "/changelog"]]} />
          <FooterColumn title={t("company")} links={[[t("about"), "/about"], [t("blog"), "/blog"], [t("useCases"), "/use-cases"]]} />
          <FooterColumn title={t("legal")} links={[[t("privacy"), "/privacy"], [t("terms"), "/terms"]]} />
          <FooterColumn title={t("openSource")} links={[["GitHub", "https://github.com/aurict/aurict"], ["npm", "https://www.npmjs.com/package/aurict"]]} />
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
        href.startsWith("http") ? (
          <a key={label} className="mono landing-footer-link" href={href} rel="noopener noreferrer" target="_blank">{label}</a>
        ) : (
          <Link key={label} className="mono landing-footer-link" href={href}>{label}</Link>
        )
      ))}
    </div>
  )
}

"use client"
import { Link } from "@/i18n/navigation"

interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        color: "var(--text-muted)",
        letterSpacing: "0.02em",
        marginBottom: 28,
      }}
    >
      {items.map((item, i) => (
        <span key={item.href} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {i > 0 && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: "var(--border-bright)" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
          {i === items.length - 1 ? (
            <span style={{ color: "var(--accent)" }}>{item.label}</span>
          ) : (
            <Link
              href={item.href}
              style={{
                color: "var(--text-muted)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

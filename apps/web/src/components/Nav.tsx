"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { BrandMark } from "@/components/BrandMark"
import { AuthNavSlot } from "@/components/auth/AuthNavSlot"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { Link } from "@/i18n/navigation"

const LINKS = [
  { href: "/roadmap", key: "roadmap" },
  { href: "/docs", key: "docs" },
  { href: "/changelog", key: "changelog" },
]

const PRODUCT_LINKS = [
  { href: "/", key: "overview" },
  { href: "/#surfaces", key: "surfaces" },
  { href: "/#capabilities", key: "capabilities" },
  { href: "/#security", key: "security" },
  { href: "/#mobile", key: "mobile" },
  { href: "/downloads", key: "downloadHoprel" },
  { href: "/#install", key: "install" },
  { href: "/#faq", key: "faq" },
]

const ECOSYSTEM_LINKS = [
  { href: "https://mobile.aurict.com", label: "aurict mobile" },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useTranslations("Nav")

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const close = () => setMenuOpen(false)
    window.addEventListener("resize", close)
    return () => window.removeEventListener("resize", close)
  }, [])

  return (
    <>
      <nav
        className="mono"
        style={{
          position:       "sticky",
          top:            0,
          zIndex:         50,
          borderBottom:   scrolled || menuOpen ? "1px solid var(--border)" : "1px solid transparent",
          background:     scrolled || menuOpen ? "color-mix(in oklch, var(--bg) 86%, transparent)" : "color-mix(in oklch, var(--bg) 62%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          className="section-shell"
          style={{
            alignItems:     "center",
            display:        "flex",
            height:         64,
            justifyContent: "space-between",
          }}
        >
          <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
            <BrandMark compact />
            <span
              style={{
                background: "oklch(1 0 0 / 0.06)",
                border:     "1px solid var(--border)",
                borderRadius: 6,
                color:      "var(--text-muted)",
                fontSize:   10.5,
                padding:    "4px 7px",
              }}
            >
              v1.2.2 · AGPLv3
            </span>
          </div>

          <div className="nav-links">
            <ProductDropdown links={PRODUCT_LINKS} />
            <EcosystemDropdown />
            {LINKS.map((link) => <NavLink key={link.href} href={link.href}>{t(link.key)}</NavLink>)}
            <LocaleSwitcher />
            <AuthNavSlot />
          </div>

          <button
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
            className="nav-burger"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8">
                <line x1="5" y1="5" x2="17" y2="17" />
                <line x1="17" y1="5" x2="5" y2="17" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8">
                <line x1="4" y1="7" x2="18" y2="7" />
                <line x1="4" y1="11" x2="18" y2="11" />
                <line x1="4" y1="15" x2="18" y2="15" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="nav-drawer" onClick={() => setMenuOpen(false)}>
          <span className="nav-drawer-label">{t("product")}</span>
          {PRODUCT_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>{t(link.key)}</Link>
          ))}
          <span className="nav-drawer-label">{t("ecosystem")}</span>
          {ECOSYSTEM_LINKS.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
          <span className="nav-drawer-label">{t("site")}</span>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>{t(link.key)}</Link>
          ))}
          <LocaleSwitcher />
          <AuthNavSlot drawer />
        </div>
      )}
    </>
  )
}

function EcosystemDropdown() {
  const t = useTranslations("Nav")

  return (
    <div className="nav-dropdown">
      <button className="nav-dropdown-trigger" type="button">
        {t("ecosystem")}
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="nav-dropdown-menu">
        {ECOSYSTEM_LINKS.map((link) => (
          <a key={link.href} className="nav-dropdown-item" href={link.href}>{link.label}</a>
        ))}
      </div>
    </div>
  )
}

function ProductDropdown({ links }: { links: Array<{ href: string; key: string }> }) {
  const t = useTranslations("Nav")

  return (
    <div className="nav-dropdown">
      <button className="nav-dropdown-trigger" type="button">
        {t("product")}
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="nav-dropdown-menu">
        {links.map((link) => (
          <Link key={link.href} className="nav-dropdown-item" href={link.href}>
            {t(link.key)}
          </Link>
        ))}
      </div>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="dim-link" href={href} style={{ fontSize: 13 }}>
      {children}
    </Link>
  )
}

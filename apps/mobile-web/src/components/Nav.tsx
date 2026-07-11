"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LanguageMenu } from "@/components/LanguageMenu";
import { useLanguage } from "@/contexts/LanguageContext";

const LINKS = [{ href: "/about-us", key: "nav.about" }];

const PRODUCT_LINKS = [
  { href: "/", key: "nav.overview" },
  { href: "/capabilities", key: "nav.capabilities" },
  { href: "/security", key: "nav.security" },
  { href: "/#apps", key: "nav.mobile" },
  { href: "/install", key: "nav.install" },
  { href: "/faq", key: "nav.faq" },
];

const X_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  return (
    <>
      <nav
        className="mono"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: scrolled || menuOpen ? "1px solid var(--border)" : "1px solid transparent",
          background: scrolled || menuOpen ? "color-mix(in oklch, var(--bg) 86%, transparent)" : "color-mix(in oklch, var(--bg) 62%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          className="section-shell"
          style={{
            alignItems: "center",
            display: "flex",
            height: 64,
            justifyContent: "space-between",
          }}
        >
          <BrandMark />

          <div className="nav-links">
            <ProductDropdown links={PRODUCT_LINKS} />
            {LINKS.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {t(link.key)}
              </NavLink>
            ))}
            <a
              className="nav-social"
              href="https://x.com/aurict"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Aurict on X"
            >
              {X_ICON}
            </a>
            <LanguageMenu />
          </div>

          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
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
          <span className="nav-drawer-label">{t("nav.product")}</span>
          {PRODUCT_LINKS.map((link) =>
            link.href.startsWith("/") ? (
              <Link key={link.href} href={link.href}>
                {t(link.key)}
              </Link>
            ) : (
              <a key={link.href} href={link.href}>
                {t(link.key)}
              </a>
            ),
          )}
          <span className="nav-drawer-label">{t("nav.site")}</span>
          {LINKS.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {t(link.key)}
            </NavLink>
          ))}
          <a href="https://x.com/aurict" target="_blank" rel="noopener noreferrer">
            {t("nav.aurictOnX")}
          </a>
        </div>
      )}
    </>
  );
}

function ProductDropdown({ links }: { links: Array<{ href: string; key: string }> }) {
  const { t } = useLanguage();
  return (
    <div className="nav-dropdown">
      <button className="nav-dropdown-trigger" type="button">
        {t("nav.product")}
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="nav-dropdown-menu">
        {links.map((link) =>
          link.href.startsWith("/") ? (
            <Link key={link.href} className="nav-dropdown-item" href={link.href}>
              {t(link.key)}
            </Link>
          ) : (
            <a key={link.href} className="nav-dropdown-item" href={link.href}>
              {t(link.key)}
            </a>
          ),
        )}
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className = "dim-link";
  const style = { fontSize: 13 };

  if (href.startsWith("/")) {
    return (
      <Link className={className} href={href} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <a className={className} href={href} style={style}>
      {children}
    </a>
  );
}

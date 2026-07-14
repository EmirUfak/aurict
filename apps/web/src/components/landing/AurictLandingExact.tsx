"use client"

import { useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { BrandMark } from "@/components/BrandMark"
import { AuthNavSlot } from "@/components/auth/AuthNavSlot"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { Link } from "@/i18n/navigation"
import { localizeWhyItems, localizeCapabilityItems, localizeSecurityProfiles, localizeInstallSteps, localizeMobileAssistantItems, localizeFaqs } from "@/content/landing-translations"
import { CopyCommand } from "@/components/CopyCommand"

const providers = ["Anthropic", "OpenAI", "Google", "xAI", "Azure", "AWS Bedrock", "Ollama", "OpenRouter"]

const integrations = ["GitHub", "PostgreSQL", "Docker", "Slack", "Jira", "Linear", "Figma", "Sentry", "Vercel", "AWS", "Notion", "Browser"]

const landingProductLinks = [
  ["overview", "#why"],
  ["downloadHoprel", "/downloads"],
  ["surfaces", "#surfaces"],
  ["capabilities", "#capabilities"],
  ["security", "#security"],
  ["mobile", "#mobile"],
  ["install", "#install"],
  ["faq", "#faq"],
]

const landingEcosystemLinks = [
  ["aurict mobile", "https://mobile.aurict.com"],
]

export function AurictLandingExact() {
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <div
      className="aur-landing"
      style={{
        background:     "var(--bg)",
        backgroundImage: "radial-gradient(oklch(1 0 0 / .035) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
        minHeight:      "100vh",
      }}
    >
      <div style={{ height: 2, background: "linear-gradient(90deg, transparent, color-mix(in oklch, var(--accent) 55%, transparent), transparent)" }} />
      <LandingNav />
      <Hero />
      <Surfaces />
      <WhyAurict />
      <Capabilities />
      <Security />
      <Mobile />
      <Install />
      <Integrations />
      <FAQ openFaq={openFaq} setOpenFaq={setOpenFaq} />
      <FinalCTA />
      <LandingFooter />
    </div>
  )
}

function LandingNav() {
  const t = useTranslations("Nav")

  return (
    <div data-screen-label="Nav" style={{ position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(10px)", background: "color-mix(in oklch, var(--bg) 82%, transparent)", borderBottom: "1px solid oklch(1 0 0 / .07)" }}>
      <div className="landing-shell landing-nav-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark compact />
          <span className="mono" style={{ fontSize: 10.5, padding: "4px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "oklch(1 0 0/.06)", color: "oklch(0.55 0.01 75)" }}>v1.2.3 · AGPLv3</span>
        </div>
        <div className="landing-nav-links">
          <div className="nav-dropdown">
            <button className="nav-dropdown-trigger" type="button">
              {t("product")}
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div className="nav-dropdown-menu">
              {landingProductLinks.map(([label, href]) => (
                <Link key={href} className="nav-dropdown-item" href={href}>{t(label)}</Link>
              ))}
            </div>
          </div>
          <div className="nav-dropdown">
            <button className="nav-dropdown-trigger" type="button">
              {t("ecosystem")}
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div className="nav-dropdown-menu">
              {landingEcosystemLinks.map(([label, href]) => (
                <a key={href} className="nav-dropdown-item" href={href}>{label}</a>
              ))}
            </div>
          </div>
          <Link className="mono landing-nav-link" href="/roadmap">{t("roadmap")}</Link>
          <Link className="mono landing-nav-link" href="/docs">{t("docs")}</Link>
          <Link className="mono landing-nav-link" href="/changelog">{t("changelog")}</Link>
          <LocaleSwitcher />
          <AuthNavSlot />
        </div>
      </div>
    </div>
  )
}

function Hero() {
  const tr = useLocale() === "tr"

  return (
    <div data-screen-label="Hero" className="landing-shell" style={{ padding: "120px 44px 80px", position: "relative" }}>
      <div style={{ position: "absolute", top: 20, left: "56%", width: 560, height: 440, background: "radial-gradient(circle, color-mix(in oklch, var(--accent) 9%, transparent), transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div className="landing-hero-grid" style={{ position: "relative", zIndex: 1 }}>
        <div>
          <div className="aur-rise mono" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, letterSpacing: ".03em", color: "var(--accent)", marginBottom: 28 }}>
            <span className="aur-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "oklch(0.72 0.15 145)" }} />
            {tr ? "açık kaynak · hoprel masaüstü · mobil · terminal" : "open source · hoprel desktop · mobile · terminal"}
          </div>
          <h1 className="aur-rise" style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 78, lineHeight: 1.03, letterSpacing: "-.015em", color: "oklch(0.96 0.004 80)", margin: "0 0 32px", animationDelay: ".05s" }}>{tr ? <>İşiniz neredeyse,<br />Aurict orada.</> : <>One intelligence.<br />Every surface.</>}</h1>
          <p className="aur-rise" style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 19, lineHeight: 1.62, color: "oklch(0.7 0.01 75)", maxWidth: 490, margin: "0 0 20px", animationDelay: ".1s" }}>{tr ? "İşiniz neredeyse Aurict oradadır: Hoprel'de yerel öncelikli masaüstü çalışma alanı, terminalde kodlama, Aurict Mobile ile araştırma ve uzaktan kontrol." : "Aurict brings agentic work to the surface that fits: Hoprel for a local-first desktop workspace, a native terminal runtime for code, and Aurict Mobile for research and remote control."}</p>
          <p className="aur-rise mono" style={{ fontSize: 13, color: "oklch(0.5 0.01 75)", margin: "0 0 40px", animationDelay: ".12s" }}>{tr ? "tek hesap · kendi sağlayıcılarınız · yerel bağlam · açık kontrol" : "one account · your providers · local context · explicit control"}</p>
          <div className="aur-rise landing-cta-row" style={{ animationDelay: ".15s" }}>
            <Link className="mono landing-button-primary" href="/downloads">↓ {tr ? "Hoprel'i indir" : "download Hoprel"}</Link>
            <CopyCommand
              className="mono landing-button-secondary"
              command="curl -fsSL https://aurict.com/install.sh | bash"
              label={tr ? "$ kur" : "$ install"}
              copiedLabel={tr ? "$ kopyalandı" : "$ copied"}
            />
            <a className="mono landing-button-secondary" href="https://github.com/aurict/aurict" rel="noopener noreferrer" target="_blank">★ GitHub</a>
          </div>
        </div>
        <TerminalMock />
      </div>

      <div className="aur-rise landing-provider-row" style={{ animationDelay: ".25s" }}>
        <span className="mono" style={{ fontSize: 11.5, color: "oklch(0.48 0.008 75)", marginRight: 8 }}>{tr ? "uyumlu" : "works with"}</span>
        {providers.map((provider) => <ProviderChip key={provider}>{provider}</ProviderChip>)}
        <span className="mono" style={{ fontSize: 11.5, color: "oklch(0.48 0.008 75)", marginLeft: 6 }}>{tr ? "+1 daha — kendi anahtarını getir" : "+1 more — bring your own key"}</span>
      </div>
    </div>
  )
}

function Surfaces() {
  const tr = useLocale() === "tr"

  return (
    <section id="surfaces" data-screen-label="Surfaces" style={{ background: "var(--bg-alt)", borderTop: "1px solid oklch(1 0 0/.06)", borderBottom: "1px solid oklch(1 0 0/.06)" }}>
      <div className="landing-shell" style={{ padding: "88px 44px" }}>
        <Eyebrow>{tr ? "aurict ekosistemi" : "the aurict ecosystem"}</Eyebrow>
        <div className="landing-section-head" style={{ marginBottom: 38 }}>
          <h2 style={h2Style({ maxWidth: 610 })}>{tr ? "Nerede çalışacağınızı seçin. Bağlamı koruyun." : "Choose the surface. Keep the context."}</h2>
          <p className="mono" style={{ maxWidth: 330, color: "oklch(0.55 0.01 75)", fontSize: 12.5, lineHeight: 1.6 }}>{tr ? "Her ürünün ayrı bir işi var. Aynı Aurict kimliği, sağlayıcıları ve çalışmanız sizinle birlikte yolculuk eder." : "Each product has a distinct job. The same Aurict identity, providers, and work travel with you."}</p>
        </div>
        <div className="landing-security-grid">
          <article className="aur-card" style={{ padding: 25, background: "var(--bg-card)", borderColor: "color-mix(in oklch, var(--accent) 42%, var(--border))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}><Image alt="Hoprel icon" height={46} src="/hoprel-icon.svg" width={46} /><div><div className="mono" style={{ color: "var(--accent)", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" }}>{tr ? "masaüstü çalışma alanı" : "desktop workspace"}</div><h3 style={{ color: "var(--text)", fontFamily: "var(--font-serif)", fontSize: 25, margin: "3px 0 0" }}>Hoprel <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 400 }}>by Aurict</span></h3></div></div>
            <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.6, marginBottom: 18 }}>{tr ? "Sohbetler, dosyalar, çıktılar, Tasarım Stüdyosu, Finans Masası ve uzaktan kontrol için yerel öncelikli bir yapay zekâ çalışma alanı." : "A local-first AI workspace for conversations, files, artifacts, Design Studio, Finance Desk, and remote control."}</p>
            <Link className="mono landing-button-secondary" href="/downloads">{tr ? "Hoprel'i indir →" : "download Hoprel →"}</Link>
          </article>
          <SurfaceCard eyebrow={tr ? "yerel çalışma zamanı" : "native runtime"} title="Aurict Terminal" body={tr ? "Ajan tabanlı kodlama, çoklu ajan yürütmesi, MCP, yerel bağlam ve açık komut onayları için açık kaynak çalışma zamanı." : "The open-source runtime for agentic coding, multi-agent execution, MCP, local context, and explicit command approvals."} href="#install" link={tr ? "kabuğunuza kurun →" : "install in your shell →"} />
          <SurfaceCard eyebrow={tr ? "yoldaş" : "companion"} title="Aurict Mobile" body={tr ? "BYOK sohbeti, araştırma, belge üretimi ve masaüstü çalışmanız ilginizi gerektirdiğinde canlı uzaktan kontrol." : "BYOK chat, research, document generation, and live remote control when your desktop work needs your attention."} href="https://mobile.aurict.com" link={tr ? "Aurict Mobile'ı ziyaret et →" : "visit Aurict Mobile →"} />
        </div>
      </div>
    </section>
  )
}

function SurfaceCard({ eyebrow, title, body, href, link }: { eyebrow: string; title: string; body: string; href: string; link: string }) {
  return <article className="aur-card" style={{ padding: 25, background: "var(--bg-card)" }}><div className="mono" style={{ color: "var(--accent)", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 13 }}>{eyebrow}</div><h3 style={{ color: "var(--text)", fontFamily: "var(--font-serif)", fontSize: 25, margin: "0 0 10px" }}>{title}</h3><p style={{ color: "var(--text-dim)", fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.6, margin: "0 0 18px" }}>{body}</p><a className="mono landing-button-secondary" href={href}>{link}</a></article>
}

function TerminalMock() {
  return (
    <div className="aur-rise" style={{ position: "relative", marginTop: 10, animationDelay: ".2s" }}>
      <div style={{ border: "1px solid color-mix(in oklch, var(--accent) 20%, transparent)", borderRadius: 8, overflow: "hidden", background: "var(--bg-deep)", boxShadow: "0 24px 60px -20px oklch(0 0 0 / .55)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", borderBottom: "1px solid oklch(1 0 0/.06)" }}>
          <div className="mono" style={{ fontSize: 12.5, color: "oklch(0.55 0.01 75)" }}>~/projects/checkout-service</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "oklch(0.78 0.15 80)" }} />
            <span className="mono" style={{ fontSize: 11.5, color: "oklch(0.78 0.15 80)" }}>awaiting permission</span>
          </div>
        </div>
        <div className="mono" style={{ padding: "22px 22px 24px", fontSize: 13.5, lineHeight: 1.9 }}>
          <div style={{ color: "oklch(0.5 0.01 75)" }}>▸ scanned: next.js 16 · pnpm · strict-mode · 212 files</div>
          <div style={{ color: "oklch(0.85 0.004 80)", marginTop: 4 }}>$ fix the race condition in webhook retry logic</div>
          <div style={{ color: "oklch(0.6 0.01 75)", marginTop: 8 }}>reading src/webhooks/retry.ts, src/queue/worker.ts…</div>
          <div style={{ color: "oklch(0.72 0.15 145)", marginTop: 8 }}>+ &nbsp;await mutex.acquire(jobId)</div>
          <div style={{ color: "oklch(0.65 0.19 25)" }}>− &nbsp;if (!locked) queue.push(job)</div>
          <div style={{ color: "oklch(0.78 0.15 80)", marginTop: 10 }}>▸ apply_patch touches 3 files outside src/webhooks — allow? (y/n) <span className="aur-cursor">▊</span></div>
        </div>
      </div>
    </div>
  )
}

function WhyAurict() {
  const tr = useLocale() === "tr"
  const whyItems = localizeWhyItems(tr ? "tr" : "en")

  return (
    <div id="why" data-screen-label="WhyAurict" className="landing-shell" style={{ padding: "64px 44px 112px" }}>
      <div className="landing-section-head">
        <h2 style={h2Style({ maxWidth: 560 })}>{tr ? "Editöre eklenmiş bir sohbet penceresi değil, ajan çalışma zamanı." : "An agent runtime, not a chat window bolted to an editor."}</h2>
        <div className="mono" style={{ fontSize: 13, color: "oklch(0.5 0.01 75)", maxWidth: 320, lineHeight: 1.6 }}>{tr ? "Çoğu yapay zekâ kodlama aracı tek bir model çağrısını sarar. Aurict, mimarinin temelinden farklı tasarlanmıştır." : "Most AI coding tools wrap a single model call. Aurict is engineered differently, from the architecture up."}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {whyItems.map(([index, title, body], itemIndex) => (
          <div key={index} className="landing-why-row" style={{ borderBottom: itemIndex === whyItems.length - 1 ? "1px solid oklch(1 0 0/.08)" : undefined }}>
            <div className="mono" style={{ fontSize: 15, color: "var(--accent)", width: 40, flex: "none" }}>{index}</div>
            <div style={{ maxWidth: 660 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 24, color: "oklch(0.93 0.004 80)", marginBottom: 9 }}>{title}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 16.5, lineHeight: 1.65, color: "oklch(0.65 0.01 75)" }}>{body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Capabilities() {
  const tr = useLocale() === "tr"
  const capabilityItems = localizeCapabilityItems(tr ? "tr" : "en")

  return (
    <div id="capabilities" data-screen-label="Capabilities" style={{ background: "var(--bg-alt)", borderTop: "1px solid oklch(1 0 0/.06)", borderBottom: "1px solid oklch(1 0 0/.06)" }}>
      <div className="landing-shell" style={{ padding: "104px 44px" }}>
        <Eyebrow>{tr ? "yetenekler" : "capabilities"}</Eyebrow>
        <h2 style={h2Style({ maxWidth: 660, margin: "0 0 52px" })}>{tr ? "Otomatik tamamlama değil. Gerçek araç erişimi olan bir yapay zekâ ekibi." : "Not autocomplete. An AI team with real tool access."}</h2>
        <div className="landing-capability-grid">
          {capabilityItems.map(([title, body, color]) => <CapabilityCard key={title} color={color} title={title} body={body} />)}
        </div>
      </div>
    </div>
  )
}

function CapabilityCard({ color, title, body }: { color: string; title: string; body: string }) {
  return (
    <div className="aur-card" style={{ position: "relative", padding: "28px 24px", background: "var(--bg-card)" }}>
      <span className="aur-corner mono" style={{ position: "absolute", top: 8, left: 8, fontSize: 15, color: "oklch(1 0 0/.18)", transition: "color .25s" }}>┌</span>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, marginBottom: 18 }} />
      <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "oklch(0.93 0.004 80)", marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 14.5, lineHeight: 1.55, color: "oklch(0.6 0.01 75)" }}>{body}</div>
    </div>
  )
}

function Security() {
  const tr = useLocale() === "tr"
  const securityProfiles = localizeSecurityProfiles(tr ? "tr" : "en")

  return (
    <div id="security" data-screen-label="Security" className="landing-shell" style={{ padding: "112px 44px" }}>
      <Eyebrow>{tr ? "güvenlik duruşu" : "security posture"}</Eyebrow>
      <h2 style={h2Style({ maxWidth: 640, margin: "0 0 16px" })}>{tr ? "Onay varsayılan; sonradan eklenen bir düşünce değil." : "Confirmation is the default, not an afterthought."}</h2>
      <p style={{ fontFamily: "var(--font-serif)", fontSize: 16.5, lineHeight: 1.6, color: "oklch(0.63 0.01 75)", maxWidth: 600, margin: "0 0 52px" }}>{tr ? "Güvenlik yeteneği tamamen modele gizli başlar. Aurict'in ne kadar ileri uzanabileceğine siz karar verirsiniz." : "Security capability starts hidden from the model entirely. You choose how far Aurict is allowed to reach."}</p>
      <div className="landing-security-grid">
        {securityProfiles.map(([tag, title, body, color]) => <SecurityCard key={title} tag={tag} title={title} body={body} color={color} />)}
      </div>
      <p className="mono" style={{ fontSize: 12.5, color: "oklch(0.48 0.008 75)", marginTop: 24 }}>$ aurict /config security allow &lt;target&gt; — every active profile still requires an allowlisted target and explicit approval.</p>
    </div>
  )
}

function SecurityCard({ tag, title, body, color }: { tag: string; title: string; body: string; color: string }) {
  return (
    <div style={{ position: "relative", padding: "28px 26px", borderRadius: 8, background: "var(--bg-card)", border: `1px solid color-mix(in oklch, ${color} 42%, transparent)` }}>
      {["┌", "┐", "└", "┘"].map((corner, index) => (
        <span key={corner} className="mono" style={{ position: "absolute", top: index < 2 ? -1 : undefined, bottom: index >= 2 ? -1 : undefined, left: index % 2 === 0 ? -1 : undefined, right: index % 2 === 1 ? -1 : undefined, fontSize: 16, color: `color-mix(in oklch, ${color} 62%, transparent)` }}>{corner}</span>
      ))}
      <div className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color, marginBottom: 16 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
        {tag}
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 21, color: "oklch(0.93 0.004 80)", marginBottom: 9 }}>{title}</div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 14.5, lineHeight: 1.6, color: "oklch(0.6 0.01 75)" }}>{body}</div>
    </div>
  )
}

function Mobile() {
  const tr = useLocale() === "tr"
  const mobileAssistantItems = localizeMobileAssistantItems(tr ? "tr" : "en")

  return (
    <div id="mobile" data-screen-label="Mobile" className="landing-shell" style={{ padding: "72px 44px 118px" }}>
      <div className="landing-mobile-grid">
        <div>
          <Eyebrow>{tr ? "mobil · BYOK asistanı" : "mobile · BYOK assistant"}</Eyebrow>
          <h2 style={h2Style({ maxWidth: 540, fontSize: 40, margin: "0 0 20px" })}>{tr ? "Cebinizde kişisel bir yapay zeka çalışma alanı." : "A personal AI workspace in your pocket."}</h2>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 16.5, lineHeight: 1.65, color: "oklch(0.63 0.01 75)", maxWidth: 520, margin: "0 0 28px" }}>{tr ? "Aurict mobil yalnızca uzak onay ekranı değildir. Kullanıcıların zaten güvendiği modellerle sohbet edebildiği, araştırma isteyebildiği, PDF ve raporlar üretebildiği ve terminalden uzakta çalışmaya devam edebildiği kendi anahtarını-getir (BYOK) asistanıdır." : "Aurict mobile is not just a remote approval screen. It is a bring-your-own-key assistant where users can chat with the models they already trust, ask for research, generate PDFs and reports, and continue work away from the terminal."}</p>

          <div className="landing-mobile-feature-grid">
            {mobileAssistantItems.map(([title, body], index) => (
              <div key={title} className="landing-mobile-feature">
                <span className="mono" style={{ color: index % 2 === 0 ? "var(--accent)" : "oklch(0.72 0.15 145)", fontSize: 11 }}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <div className="mono" style={{ color: "oklch(0.9 0.004 80)", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{title}</div>
                  <div style={{ fontFamily: "var(--font-serif)", color: "oklch(0.62 0.01 75)", fontSize: 14.5, lineHeight: 1.55 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 500, marginTop: 28 }}>
            <MobileBullet color="oklch(0.72 0.15 145)">{tr ? "modern bir yapay zeka asistanı gibi sohbet edin, her kullanıcıyı tek bir sağlayıcıya kilitlemeden" : "chat like a modern AI assistant, without locking every user into one provider"}</MobileBullet>
            <MobileBullet color="oklch(0.78 0.15 80)">{tr ? "aynı hesaptan araştırın, özetleyin, karşılaştırın, planlayın, taslak çıkarın ve sonuçları dışa aktarın" : "research, summarize, compare, plan, draft, and export results from the same account"}</MobileBullet>
            <MobileBullet color="var(--accent)">{tr ? "canlı CLI oturumlarını yansıtın — bir terminal eylemi izin gerektirdiğinde onaylayın, reddedin veya durdurun" : "mirror live CLI sessions — approve, deny, or stop work when a terminal action needs permission"}</MobileBullet>
          </div>
        </div>
        <PhoneMock />
      </div>
    </div>
  )
}

function PhoneMock() {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div className="landing-phone">
        <div style={{ width: 86, height: 24, borderRadius: "0 0 16px 16px", background: "oklch(0.02 0 0)", position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", zIndex: 2 }} />
        <div className="mono" style={{ padding: "62px 16px 18px", height: "100%", boxSizing: "border-box", background: "var(--bg)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 12px", borderBottom: "1px solid oklch(1 0 0/.08)" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "oklch(0.95 0.004 80)" }}>aurict mobile</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "oklch(0.72 0.15 145)" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.72 0.15 145)" }} />BYOK</span>
          </div>
          <ChatBubble role="user">Research AI support tools for solo founders and make a PDF brief.</ChatBubble>
          <ChatBubble role="assistant">I&apos;ll compare pricing, workflows, and positioning, then export a 6-page PDF summary.</ChatBubble>
          <MobileTask title="research scan" status="running" detail="12 sources · competitor notes · citations" />
          <MobileTask title="PDF brief" status="ready" detail="market-summary.pdf · 6 pages" />
          <SessionCard active />
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  const user = role === "user"

  return (
    <div style={{ alignSelf: user ? "flex-end" : "flex-start", maxWidth: "88%" }}>
      <div
        style={{
          background: user ? "var(--accent)" : "var(--bg-card)",
          border: user ? "1px solid var(--accent)" : "1px solid oklch(1 0 0/.08)",
          borderRadius: user ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          color: user ? "var(--accent-ink)" : "oklch(0.82 0.004 80)",
          fontFamily: "var(--font-serif)",
          fontSize: 12.5,
          lineHeight: 1.45,
          padding: "10px 12px",
        }}
      >
        {children}
      </div>
    </div>
  )
}

function MobileTask({ title, status, detail }: { title: string; status: string; detail: string }) {
  return (
    <div style={{ border: "1px solid oklch(1 0 0/.08)", borderRadius: 8, padding: "11px 12px", background: "color-mix(in oklch, var(--bg-card) 76%, transparent)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: "oklch(0.88 0.004 80)", fontSize: 11.5, fontWeight: 600 }}>{title}</span>
        <span style={{ color: status === "ready" ? "oklch(0.72 0.15 145)" : "oklch(0.78 0.15 80)", fontSize: 10 }}>{status}</span>
      </div>
      <div style={{ color: "oklch(0.58 0.01 75)", fontSize: 10.5, lineHeight: 1.4 }}>{detail}</div>
    </div>
  )
}

function SessionCard({ active = false }: { active?: boolean }) {
  return (
    <div style={{ border: active ? "1px solid oklch(0.78 0.15 80 / .35)" : "1px solid oklch(1 0 0/.08)", borderRadius: 8, padding: 14, opacity: active ? 1 : .6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: active ? 8 : 6 }}>
        <span style={{ fontSize: 11.5, color: "oklch(0.6 0.01 75)" }}>{active ? "CLI session" : "~/marketing-site"}</span>
        <span style={{ fontSize: 10, color: active ? "oklch(0.78 0.15 80)" : "oklch(0.72 0.15 145)" }}>{active ? "approval" : "running"}</span>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: active ? "oklch(0.82 0.004 80)" : "oklch(0.72 0.01 75)", marginBottom: active ? 12 : 0 }}>
        {active ? "approve a terminal action from mobile" : "explore-agent reading 84 files…"}
      </div>
      {active && (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 6, background: "oklch(0.72 0.15 145)", color: "oklch(0.12 0.02 145)", fontSize: 11.5, fontWeight: 600 }}>approve</div>
          <div style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 6, border: "1px solid oklch(1 0 0/.16)", color: "oklch(0.8 0.01 75)", fontSize: 11.5 }}>deny</div>
        </div>
      )}
    </div>
  )
}

function Install() {
  const tr = useLocale() === "tr"
  const installSteps = localizeInstallSteps(tr ? "tr" : "en")

  return (
    <div id="install" data-screen-label="Install" style={{ background: "var(--bg-alt)", borderTop: "1px solid oklch(1 0 0/.06)", borderBottom: "1px solid oklch(1 0 0/.06)" }}>
      <div className="landing-shell" style={{ padding: "112px 44px" }}>
        <Eyebrow>{tr ? "kurulum" : "install"}</Eyebrow>
        <h2 style={h2Style({ maxWidth: 600, margin: "0 0 56px" })}>{tr ? "Otuz saniye, tek komut, halihazırda kullandığınız kabuk." : "Thirty seconds, one command, your existing shell."}</h2>
        <div className="landing-install-grid">
          {installSteps.map(([title, code, note, color]) => (
            <div key={title}>
              <div className="mono" style={{ fontSize: 12, color, marginBottom: 10 }}>{title}</div>
              {code.startsWith("#")
                ? <div className="mono" style={{ background: "var(--bg-deep)", border: "1px solid oklch(1 0 0/.08)", borderRadius: 6, padding: "14px 16px", fontSize: 12.5, color: "oklch(0.6 0.01 75)", marginBottom: 12 }}>{code}</div>
                : <CopyCommand command={code} color="oklch(0.88 0.004 80)" />}
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, lineHeight: 1.5, color: "oklch(0.58 0.01 75)" }}>{note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Integrations() {
  const tr = useLocale() === "tr"

  return (
    <div data-screen-label="Integrations" className="landing-shell" style={{ padding: "96px 44px" }}>
      <div className="landing-section-head" style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 32, color: "oklch(0.95 0.004 80)", margin: 0 }}>{tr ? "Zaten kullandığınız araçlarla çalışır." : "Works with the tools you already run."}</h2>
        <div className="mono" style={{ fontSize: 12.5, color: "oklch(0.5 0.01 75)" }}>{tr ? "MCP ile — bir yapılandırma dosyası olan her şeyi bağlayın" : "via MCP — connect anything with a config file"}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {integrations.map((item) => <span key={item} className="mono landing-pill">{item}</span>)}
      </div>
    </div>
  )
}

function FAQ({ openFaq, setOpenFaq }: { openFaq: number; setOpenFaq: (value: number) => void }) {
  const tr = useLocale() === "tr"
  const faqs = localizeFaqs(tr ? "tr" : "en")

  return (
    <div id="faq" data-screen-label="FAQ" style={{ maxWidth: 820, margin: "0 auto", padding: "80px 44px 112px" }}>
      <Eyebrow>{tr ? "sss" : "faq"}</Eyebrow>
      <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 38, color: "oklch(0.95 0.004 80)", margin: "0 0 44px" }}>{tr ? "Mühendislerin gerçekten sorduğu sorular." : "Questions engineers actually ask."}</h2>
      <div style={{ borderTop: "1px solid oklch(1 0 0/.1)" }}>
        {faqs.map(([question, answer], index) => (
          <div key={question} style={{ padding: "22px 0", borderBottom: "1px solid oklch(1 0 0/.1)", cursor: "pointer" }} onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, color: "oklch(0.9 0.004 80)" }}>
              {question}<span style={{ color: "oklch(0.5 0.01 75)" }}>{openFaq === index ? "−" : "+"}</span>
            </div>
            {openFaq === index && <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.6, color: "oklch(0.63 0.01 75)", marginTop: 14, maxWidth: 640 }}>{answer}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function FinalCTA() {
  const tr = useLocale() === "tr"

  return (
    <div data-screen-label="FinalCTA" style={{ background: "var(--bg-alt)", borderTop: "1px solid oklch(1 0 0/.06)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "104px 44px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 40, letterSpacing: "-.01em", color: "oklch(0.95 0.004 80)", margin: "0 0 16px" }}>{tr ? "İşinizin ait olduğu yerde başlayın." : "Start where your work belongs."}</h2>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 16.5, color: "oklch(0.63 0.01 75)", margin: "0 0 36px" }}>{tr ? "Yerel öncelikli bir masaüstü çalışma alanı için Hoprel'i indirin veya Aurict'i doğrudan terminalinizde çalıştırın." : "Download Hoprel for a local-first desktop workspace, or run Aurict directly in your terminal."}</p>
        <div className="landing-final-buttons">
          <a className="mono landing-button-primary" href="/downloads">{tr ? "↓ Hoprel'i indir" : "↓ download Hoprel"}</a>
          <a className="mono landing-button-secondary" href="#install">{tr ? "$ hızlı kurulum" : "$ quick install"}</a>
        </div>
      </div>
    </div>
  )
}

function LandingFooter() {
  const tr = useLocale() === "tr"

  return (
    <div data-screen-label="Footer" className="landing-shell landing-footer">
      <div>
        <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: "oklch(0.9 0.004 80)", marginBottom: 10 }}>aurict</div>
        <div className="mono" style={{ fontSize: 12, color: "oklch(0.5 0.01 75)" }}>{tr ? "AGPLv3 Lisansı · © 2026 aurict" : "AGPLv3 License · © 2026 aurict"}</div>
      </div>
      <div style={{ display: "flex", gap: 56, flexWrap: "wrap" }}>
        <FooterColumn title={tr ? "ürün" : "product"} links={[[tr ? "Hoprel masaüstü" : "Hoprel desktop", "/downloads"], [tr ? "yetenekler" : "capabilities", "#capabilities"], [tr ? "yol haritası" : "roadmap", "/roadmap"], [tr ? "karşılaştır" : "compare", "/compare"], [tr ? "belgeler" : "docs", "/docs"], [tr ? "değişiklik günlüğü" : "changelog", "/changelog"]]} />
        <FooterColumn title={tr ? "şirket" : "company"} links={[[tr ? "hakkında" : "about", "/about"], ["blog", "/blog"], [tr ? "kullanım senaryoları" : "use cases", "/use-cases"]]} />
        <FooterColumn title={tr ? "yasal" : "legal"} links={[[tr ? "gizlilik" : "privacy", "/privacy"], [tr ? "koşullar" : "terms", "/terms"]]} />
        <FooterColumn title={tr ? "açık kaynak" : "open source"} links={[["GitHub", "https://github.com/aurict/aurict"], ["npm", "https://www.npmjs.com/package/aurict"]]} />
      </div>
    </div>
  )
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "oklch(0.42 0.008 75)", marginBottom: 4 }}>{title}</div>
      {links.map(([label, href]) => <a key={label} className="mono landing-footer-link" href={href}>{label}</a>)}
    </div>
  )
}

function ProviderChip({ children }: { children: ReactNode }) {
  return <span className="mono" style={{ fontSize: 12, padding: "5px 11px", borderRadius: 999, border: "1px solid oklch(1 0 0/.1)", color: "oklch(0.68 0.01 75)" }}>{children}</span>
}

function MobileBullet({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, marginTop: 7, flex: "none" }} />
      <span className="mono" style={{ fontSize: 13.5, color: "oklch(0.68 0.01 75)" }}>{children}</span>
    </div>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="mono" style={{ fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "oklch(0.52 0.01 75)", marginBottom: 16 }}>{children}</div>
}

function h2Style(overrides: CSSProperties = {}): CSSProperties {
  return {
    fontFamily:    "var(--font-serif)",
    fontWeight:    600,
    fontSize:      44,
    letterSpacing: "-.01em",
    color:         "oklch(0.95 0.004 80)",
    margin:        0,
    ...overrides,
  }
}

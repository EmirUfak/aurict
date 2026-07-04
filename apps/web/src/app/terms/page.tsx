import type { Metadata } from "next"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/sections/Footer"
import { Breadcrumb } from "@/components/ui/Breadcrumb"

export const metadata: Metadata = {
  title:       "Terms of Use — Aurict",
  description: "Aurict terms of use covering open-source software, BYOK responsibilities, acceptable use, security workflows, disclaimers, and policy changes.",
  alternates:  { canonical: "https://aurict.com/terms" },
  openGraph: {
    title:       "Terms of Use — Aurict",
    description: "Rules and responsibilities for using Aurict.",
    url:         "https://aurict.com/terms",
  },
}

const sections = [
  {
    title: "1. Acceptance",
    body: [
      "By accessing the Aurict website, using the Aurict software, installing the CLI, using the mobile app, connecting a provider, or interacting with related services, you agree to these Terms of Use.",
      "If you do not agree, do not use Aurict.",
    ],
  },
  {
    title: "2. Open-source software and license",
    body: [
      "Aurict is provided as open-source software under the license stated in the repository, currently GNU Affero General Public License v3 for the core project unless a specific file, package, or component states otherwise.",
      "The open-source license governs your rights to copy, modify, distribute, and use the source code. These Terms govern your use of the website, hosted features, account flows, device login, documentation, branding, and related services.",
    ],
  },
  {
    title: "3. BYOK responsibility",
    body: [
      "Aurict uses a Bring Your Own Key model. You are responsible for the API keys, model accounts, billing, quotas, provider terms, and third-party services you connect.",
      "Aurict does not control the pricing, output quality, availability, retention, moderation, or privacy behavior of external model providers.",
      "You are responsible for protecting your keys and for all usage, charges, prompts, outputs, and consequences that occur through your connected providers.",
    ],
  },
  {
    title: "4. AI output and professional judgment",
    body: [
      "Aurict may generate, transform, summarize, or execute technical instructions using AI models. Outputs may be incomplete, incorrect, insecure, outdated, or unsuitable for your use case.",
      "You are responsible for reviewing, testing, validating, and approving outputs before relying on them.",
      "Aurict does not provide legal, medical, financial, compliance, or professional advice.",
    ],
  },
  {
    title: "5. Security and cybersecurity features",
    body: [
      "Aurict may include security analysis, code review, sandbox execution, command classification, MCP integrations, browser workflows, and optional cybersecurity tooling.",
      "You may use these features only on systems, accounts, networks, repositories, devices, or targets that you own or are explicitly authorized to test.",
      "You must not use Aurict for unauthorized access, credential theft, malware, persistence, evasion, data exfiltration, harassment, abuse, or any illegal activity.",
    ],
  },
  {
    title: "6. Accounts, device login, and access",
    body: [
      "Aurict may provide account, authentication, browser login, device approval, or session control features. You are responsible for keeping your account and devices secure.",
      "Aurict and the repository owner may restrict, suspend, revoke, change, or discontinue access to hosted features where necessary for security, abuse prevention, maintenance, legal compliance, or product direction.",
    ],
  },
  {
    title: "7. Data practices may change",
    body: [
      "Aurict does not currently intend to collect product telemetry, chat content, repository contents, prompts, generated files, or API keys by default through the public website or open-source CLI.",
      "This may change in the future. Aurict may introduce data collection for accounts, billing, telemetry, crash reporting, analytics, security, fraud prevention, abuse prevention, or product operation.",
      "Future use may be subject to updated privacy terms, consent flows, notices, configuration options, or provider-specific requirements.",
    ],
  },
  {
    title: "8. Changes to these Terms",
    body: [
      "Aurict and the repository owner reserve the right to update, replace, expand, narrow, suspend, or remove these Terms at any time.",
      "Changes may be posted on the website, in the repository, in release notes, or through other reasonable channels. Continued use after changes are posted may be treated as acceptance of the updated Terms where permitted by law.",
    ],
  },
  {
    title: "9. Disclaimer and limitation of liability",
    body: [
      "Aurict is provided as-is and as-available, without warranties of any kind to the maximum extent permitted by law.",
      "Aurict, its repository owner, maintainers, contributors, and related parties are not liable for lost profits, lost data, provider charges, security incidents, business interruption, model errors, unauthorized use, or indirect, incidental, special, consequential, or punitive damages arising from your use of Aurict.",
    ],
  },
]

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="marketing-main marketing-main-narrow">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Terms", href: "/terms" }]} />
        <section className="marketing-hero" style={{ marginTop: 24 }}>
          <p className="marketing-eyebrow">Legal</p>
          <h1 className="marketing-title marketing-title-sm">Terms of Use</h1>
          <p className="marketing-lede">
            Effective July 2, 2026. These terms define the rules for using Aurict, including BYOK responsibilities, security boundaries, account flows, and future policy changes.
          </p>
        </section>

        <LegalSections sections={sections} />
      </main>
      <Footer />
    </>
  )
}

function LegalSections({ sections }: { sections: Array<{ title: string; body: string[] }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="marketing-section-title">{section.title}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="marketing-copy">{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

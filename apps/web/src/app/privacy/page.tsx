import type { Metadata } from "next"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/sections/Footer"
import { Breadcrumb } from "@/components/ui/Breadcrumb"

export const metadata: Metadata = {
  title:       "Privacy Policy — Aurict",
  description: "Aurict privacy policy covering current data collection, BYOK workflows, third-party providers, future changes, and user responsibilities.",
  alternates:  { canonical: "https://aurict.com/privacy" },
  openGraph: {
    title:       "Privacy Policy — Aurict",
    description: "How Aurict handles privacy, data, BYOK workflows, and future policy changes.",
    url:         "https://aurict.com/privacy",
  },
}

const sections = [
  {
    title: "1. Current data collection",
    body: [
      "As of July 2, 2026, Aurict does not intentionally collect product telemetry, chat content, repository contents, API keys, prompts, generated files, or usage analytics through the public website or the open-source CLI by default.",
      "If you choose to use account, authentication, device login, support, waitlist, or similar features, the information you submit or authorize may be processed only as needed to provide that feature.",
      "Aurict does not currently operate advertising trackers, behavioral advertising profiles, or paid analytics tracking on the public website.",
    ],
  },
  {
    title: "2. Bring Your Own Key model",
    body: [
      "Aurict is designed around BYOK: Bring Your Own Key. You are responsible for the API keys, model providers, billing accounts, and third-party services you connect.",
      "Model provider keys should be handled as secrets. Do not share them publicly, commit them to repositories, paste them into untrusted contexts, or expose them to unauthorized users.",
      "When you use external model providers, those providers may process your prompts, files, outputs, metadata, and account data under their own policies and terms.",
    ],
  },
  {
    title: "3. Authentication and third-party services",
    body: [
      "Aurict may use third-party infrastructure such as Firebase, Google, GitHub, hosting providers, package registries, and model providers to deliver authentication, device login, downloads, releases, or integrations.",
      "Those services may receive technical information such as account identifiers, email addresses, authentication tokens, IP addresses, device metadata, logs, or request metadata depending on the feature you use.",
      "Aurict does not control third-party privacy practices. You should review the policies of any provider you connect to Aurict.",
    ],
  },
  {
    title: "4. Local-first and open-source workflows",
    body: [
      "The open-source Aurict CLI is intended to run primarily in your own environment. Local configuration, project files, session data, and provider keys may remain on your device or infrastructure depending on how you configure the software.",
      "If you connect MCP servers, cloud accounts, databases, browsers, GitHub, or other tools, data may flow through those systems according to your configuration.",
      "You are responsible for understanding what tools you enable and what data those tools can access.",
    ],
  },
  {
    title: "5. Future data collection may change",
    body: [
      "Aurict may add optional or required data collection in the future, including but not limited to account data, billing data, crash reports, abuse prevention logs, security logs, analytics, waitlist/contact information, device login metadata, or product telemetry.",
      "If data practices materially change, Aurict may update this Privacy Policy and may provide notice through the website, application, repository, release notes, or other reasonable channels.",
      "Continued use after an update may be treated as acceptance of the updated policy where permitted by law.",
    ],
  },
  {
    title: "6. Security",
    body: [
      "Aurict aims to minimize unnecessary data collection. This follows a practical security principle: do not collect or retain sensitive information unless there is a legitimate product or operational need.",
      "No software, website, network, or third-party provider is perfectly secure. You are responsible for securing your own devices, repositories, API keys, provider accounts, and deployment environments.",
      "If you discover a vulnerability, report it responsibly through the repository or the contact channel provided by the project owner.",
    ],
  },
  {
    title: "7. Policy ownership and changes",
    body: [
      "Aurict and the repository owner reserve the right to update, replace, expand, narrow, suspend, or remove this Privacy Policy at any time.",
      "This policy is provided to explain the current intended privacy posture of the project. It is not legal advice and does not create contractual rights beyond those required by applicable law.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="marketing-main marketing-main-narrow">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Privacy", href: "/privacy" }]} />
        <section className="marketing-hero" style={{ marginTop: 24 }}>
          <p className="marketing-eyebrow">Legal</p>
          <h1 className="marketing-title marketing-title-sm">Privacy Policy</h1>
          <p className="marketing-lede">
            Effective July 2, 2026. This policy explains Aurict&apos;s current privacy posture, BYOK model, third-party dependencies, and how future data practices may change.
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

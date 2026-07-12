import type { Metadata } from "next"
import { AurictLandingExact } from "@/components/landing/AurictLandingExact"

export const metadata: Metadata = {
  alternates: { canonical: "https://aurict.com" },
}

const faqJsonLd = {
  "@context":  "https://schema.org",
  "@type":     "FAQPage",
  "mainEntity": [
    {
      "@type":          "Question",
      "name":           "Is Aurict free?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes — Aurict is open source under the GNU Affero General Public License v3. You bring your own API key for whichever AI provider you choose. There are no subscription fees for the core tool." },
    },
    {
      "@type":          "Question",
      "name":           "How is Aurict different from Claude Code?",
      "acceptedAnswer": { "@type": "Answer", "text": "Claude Code is tied to Anthropic only. Aurict supports 9 providers, ships with 9 specialist agents, 218+ auto-injected skills, a bash command classifier, and runs as a native binary — no Node.js runtime required." },
    },
    {
      "@type":          "Question",
      "name":           "Does Hoprel work on Windows?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. Hoprel by Aurict ships a native Windows x64 desktop workspace. It also has a Debian package; the Aurict terminal runtime remains available separately through npm." },
    },
    {
      "@type":          "Question",
      "name":           "Which AI providers does Aurict support?",
      "acceptedAnswer": { "@type": "Answer", "text": "Anthropic (Claude), OpenAI (GPT-4o, o1), Google (Gemini), OpenRouter, xAI (Grok), Azure OpenAI, AWS Bedrock, Ollama (local models), and OpenCode — switchable at any time with /providers." },
    },
    {
      "@type":          "Question",
      "name":           "What does the Aurict mobile app do?",
      "acceptedAnswer": { "@type": "Answer", "text": "Aurict mobile is a bring-your-own-key AI assistant and CLI companion. Users can chat with providers like OpenAI, Anthropic, Google, and OpenRouter, run research tasks, generate PDFs and reports, and approve terminal actions from their phone." },
    },
    {
      "@type":          "Question",
      "name":           "Do I need Node.js installed to run Aurict?",
      "acceptedAnswer": { "@type": "Answer", "text": "No. Aurict installs via npm install -g aurict but runs as a self-contained native binary. Node.js is only needed for the install step itself." },
    },
    {
      "@type":          "Question",
      "name":           "Can I use my existing MCP servers with Aurict?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes — Aurict reads your claude_desktop_config.json automatically. Any MCP server you have configured for Claude Desktop works immediately." },
    },
  ],
}

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type":    "HowTo",
  "name":     "How to install and run Aurict",
  "description": "Install and run the open-source Aurict terminal runtime in three steps.",
  "totalTime": "PT1M",
  "step": [
    {
      "@type":    "HowToStep",
      "position": 1,
      "name":     "Install",
      "text":     "Run npm install -g aurict in your terminal. Works on macOS, Linux, and Windows.",
      "url":      "https://aurict.com/#install",
    },
    {
      "@type":    "HowToStep",
      "position": 2,
      "name":     "Run",
      "text":     "Navigate to your project directory and run aurict to launch the terminal UI.",
      "url":      "https://aurict.com/#install",
    },
    {
      "@type":    "HowToStep",
      "position": 3,
      "name":     "Configure",
      "text":     "On first launch, an interactive wizard guides you through selecting a provider, entering your API key, and choosing a model.",
      "url":      "https://aurict.com/docs",
    },
  ],
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type":               "SoftwareApplication",
      "name":                "Aurict",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem":     "macOS, Linux, Windows",
      "description":         "Open-source terminal runtime for multi-agent coding, MCP, local context, and explicit command approvals. Aurict also ships Hoprel, its local-first desktop workspace, and Aurict Mobile.",
      "url":                 "https://aurict.com",
      "downloadUrl":         "https://www.npmjs.com/package/aurict",
      "installUrl":          "https://www.npmjs.com/package/aurict",
      "softwareVersion":     "1.2.0",
      "releaseNotes":        "https://aurict.com/changelog",
      "license":             "https://www.gnu.org/licenses/agpl-3.0.html",
      "author": {
        "@type": "Organization",
        "name":  "aurict",
        "url":   "https://github.com/aurict",
      },
      "offers": {
        "@type":         "Offer",
        "price":         "0",
        "priceCurrency": "USD",
      },
      "screenshot":  "https://aurict.com/opengraph-image",
      "featureList": [
        "9 specialist AI agents (Explore, Code, Review, Test, Docs, Security, Debug, Performance, Analytics)",
        "218+ auto-injected contextual skills",
        "Bash command classifier — dangerous commands require confirmation",
        "MCP client — reads claude_desktop_config.json",
        "Multi-provider: Anthropic, OpenAI, OpenRouter, Google, xAI, Azure, AWS Bedrock, Ollama",
        "Mobile BYOK AI assistant for chat, research, PDF generation, and reports",
        "Mobile CLI companion for browser login, permission approvals, and live session control",
        "Design agent wizard with 150+ design systems",
        "Persistent memory across sessions",
        "Custom tool and skill loader",
        "Session checkpoint and branching",
      ],
    },
    {
      "@type":               "SoftwareApplication",
      "name":                "Hoprel by Aurict",
      "applicationCategory": "ProductivityApplication",
      "operatingSystem":     "Windows, Debian / Ubuntu",
      "description":         "A local-first desktop AI workspace for conversations, files, artifacts, design, finance research, deterministic calculations, and mobile remote control.",
      "url":                 "https://aurict.com/downloads",
      "downloadUrl":         "https://aurict.com/downloads",
      "author": { "@type": "Organization", "name": "Aurict", "url": "https://aurict.com" },
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type":       "WebSite",
      "url":         "https://aurict.com",
      "name":        "Aurict",
      "description": "Agentic workspaces across Hoprel desktop, Aurict Mobile, and the terminal runtime",
    },
    {
      "@type":  "Organization",
      "name":   "aurict",
      "url":    "https://aurict.com",
      "sameAs": [
        "https://github.com/aurict/aurict",
        "https://www.npmjs.com/package/aurict",
      ],
    },
  ],
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <AurictLandingExact />
    </>
  )
}

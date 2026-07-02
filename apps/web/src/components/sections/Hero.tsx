"use client"

import { m } from "framer-motion"
import { TerminalWindow } from "@/components/terminal/TerminalWindow"

const SYSTEM_LINES = [
  ["agents", "explore · code · review · test · docs · security"],
  ["context", "skills loaded lazily, cache boundary preserved"],
  ["guardrails", "sandbox policy active, approvals required"],
]

export function Hero() {
  return (
    <section
      style={{
        overflow: "hidden",
        padding:   "112px 0 96px",
        position:  "relative",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          background: "radial-gradient(circle, color-mix(in oklch, var(--accent) 22%, transparent), transparent 64%)",
          filter:     "blur(6px)",
          height:     620,
          left:       "58%",
          opacity:    0.42,
          position:   "absolute",
          top:        12,
          transform:  "translateX(-50%)",
          width:      820,
        }}
      />

      <div
        className="section-shell"
        style={{
          alignItems:           "center",
          display:              "grid",
          gap:                  56,
          gridTemplateColumns:  "repeat(auto-fit, minmax(min(100%, 460px), 1fr))",
          position:             "relative",
          zIndex:               1,
        }}
      >
        <div>
          <m.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.55 }}
            className="eyebrow mono"
            style={{ marginBottom: 18 }}
          >
            open-source terminal ai agent
          </m.div>

          <m.h1
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.08, duration: 0.65 }}
            className="section-title"
            style={{
              fontSize:     "clamp(52px, 7vw, 88px)",
              marginBottom: 24,
              maxWidth:     760,
            }}
          >
            Your terminal, rebuilt as an agent runtime.
          </m.h1>

          <m.p
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 14 }}
            transition={{ delay: 0.18, duration: 0.55 }}
            className="section-copy"
            style={{ marginBottom: 34, maxWidth: 610 }}
          >
            Aurict coordinates specialist agents, project-aware skills, sandboxed tools, and any model provider without forcing you into an IDE or proprietary cloud.
          </m.p>

          <m.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.28, duration: 0.5 }}
            style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 14 }}
          >
            <a className="aur-button aur-button-primary" href="#install">
              $ npm install -g aurict
            </a>
            <a className="aur-button aur-button-secondary" href="https://github.com/aurict/aurict" rel="noopener noreferrer" target="_blank">
              star on GitHub
            </a>
          </m.div>

          <m.div
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={{ delay: 0.44, duration: 0.55 }}
            style={{ display: "grid", gap: 10, marginTop: 42 }}
          >
            {SYSTEM_LINES.map(([label, value]) => (
              <div key={label} className="mono" style={{ alignItems: "center", display: "flex", gap: 12 }}>
                <span style={{ color: "var(--accent)", fontSize: 12, width: 76 }}>{label}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>{value}</span>
              </div>
            ))}
          </m.div>
        </div>

        <m.div
          animate={{ opacity: 1, y: 0, scale: 1 }}
          initial={{ opacity: 0, y: 28, scale: 0.985 }}
          transition={{ delay: 0.18, duration: 0.72, ease: [0.16, 0.8, 0.2, 1] }}
          style={{ display: "grid", gap: 16 }}
        >
          <TerminalWindow />
          <div
            className="aur-card mono"
            style={{
              display:              "grid",
              gap:                  1,
              gridTemplateColumns:  "repeat(3, minmax(0, 1fr))",
              overflow:             "hidden",
            }}
          >
            {[
              ["9", "specialist agents"],
              ["218+", "contextual skills"],
              ["3", "native platforms"],
            ].map(([value, label]) => (
              <div key={label} style={{ background: "var(--bg-alt)", padding: "18px 20px" }}>
                <div style={{ color: "var(--accent)", fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{value}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 11.5, marginTop: 8 }}>{label}</div>
              </div>
            ))}
          </div>
        </m.div>
      </div>
    </section>
  )
}

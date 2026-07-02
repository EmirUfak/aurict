"use client"

import { m } from "framer-motion"

const STATS = [
  ["9", "specialist agents", "Explore, code, review, test, docs, security, debug, performance, analytics."],
  ["218+", "contextual skills", "Framework and project signals select the right context without manual attachment."],
  ["native", "macOS · Linux · Windows", "Installed through npm, executed as a compiled standalone binary."],
]

const DIFFERENTIATORS = [
  {
    index: "01",
    title: "Coordinator-first architecture",
    body: "Aurict routes work through specialized agents instead of hoping a single prompt keeps every concern in memory.",
  },
  {
    index: "02",
    title: "Context is treated as infrastructure",
    body: "Static, session, dynamic, skills, memories, tools, and cached boundaries are separated so attention is not wasted.",
  },
  {
    index: "03",
    title: "Tools are gated, not blindly exposed",
    body: "Bash classification, sandbox policy, approvals, protected paths, output limits, and optional security profiles keep execution controlled.",
  },
  {
    index: "04",
    title: "Open where it matters",
    body: "Use your own model provider, MCP servers, skills, slash commands, and workflows without moving the codebase into a vendor IDE.",
  },
]

export function WhyAurict() {
  return (
    <section id="why" className="resp-section" style={{ padding: "118px 0" }}>
      <div className="section-shell">
        <div style={{ display: "grid", gap: 28, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", marginBottom: 64 }}>
          <div>
            <m.div className="eyebrow" initial={{ opacity: 0 }} transition={{ duration: 0.45 }} viewport={{ once: true }} whileInView={{ opacity: 1 }}>
              why aurict
            </m.div>
            <m.h2
              className="section-title"
              initial={{ opacity: 0, y: 14 }}
              transition={{ delay: 0.08, duration: 0.55 }}
              viewport={{ once: true, margin: "-60px" }}
              whileInView={{ opacity: 1, y: 0 }}
              style={{ marginTop: 16 }}
            >
              Not a chat box. A runtime for real developer work.
            </m.h2>
          </div>
          <m.p
            className="section-copy"
            initial={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.16, duration: 0.5 }}
            viewport={{ once: true, margin: "-60px" }}
            whileInView={{ opacity: 1, y: 0 }}
            style={{ alignSelf: "end" }}
          >
            The design is opinionated: keep the model focused, keep tools accountable, and make long-running tasks survive real project complexity.
          </m.p>
        </div>

        <div
          className="resp-grid-3"
          style={{
            background:   "var(--border)",
            border:       "1px solid var(--border)",
            borderRadius:  12,
            gap:          1,
            marginBottom: 68,
            overflow:     "hidden",
          }}
        >
          {STATS.map(([value, label, detail], index) => (
            <m.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              transition={{ delay: index * 0.08, duration: 0.48 }}
              viewport={{ once: true, margin: "-40px" }}
              whileInView={{ opacity: 1, y: 0 }}
              style={{ background: "var(--bg-alt)", padding: "34px 32px" }}
            >
              <div className="mono" style={{ color: "var(--accent)", fontSize: 42, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>
                {value}
              </div>
              <h3 style={{ color: "var(--text)", fontSize: 18, fontWeight: 600, marginTop: 16 }}>
                {label}
              </h3>
              <p className="mono" style={{ color: "var(--text-muted)", fontSize: 12.5, lineHeight: 1.65, marginTop: 10 }}>
                {detail}
              </p>
            </m.div>
          ))}
        </div>

        <div>
          {DIFFERENTIATORS.map((item, index) => (
            <m.div
              key={item.index}
              className="resp-diff"
              initial={{ opacity: 0, x: -14 }}
              transition={{ delay: index * 0.06, duration: 0.45 }}
              viewport={{ once: true, margin: "-30px" }}
              whileInView={{ opacity: 1, x: 0 }}
              style={{
                borderBottom: index < DIFFERENTIATORS.length - 1 ? "1px solid var(--border)" : "none",
                padding:      "28px 0",
              }}
            >
              <span className="mono" style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {item.index}
              </span>
              <h3 style={{ color: "var(--text)", fontSize: 18, fontWeight: 600, lineHeight: 1.35 }}>
                {item.title}
              </h3>
              <p className="section-copy" style={{ fontSize: 15, margin: 0 }}>
                {item.body}
              </p>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  )
}

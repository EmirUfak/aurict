"use client"

import { m } from "framer-motion"
import {
  Activity,
  Boxes,
  BrainCircuit,
  Cpu,
  Gauge,
  GitBranch,
  RadioTower,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react"
import { TerminalWindow } from "@/components/terminal/TerminalWindow"

const AGENTS = [
  { name: "Explore",  status: "mapping repo",       load: 92, color: "#a78bfa" },
  { name: "Code",     status: "patch queued",       load: 76, color: "#38bdf8" },
  { name: "Review",   status: "risk pass",          load: 68, color: "#f59e0b" },
  { name: "Security", status: "gateguard armed",    load: 84, color: "#ff6b6b" },
  { name: "Perf",     status: "trace sampling",     load: 51, color: "#06b6d4" },
]

const TELEMETRY = [
  { label: "Context", value: "184k", detail: "tokens available", icon: Gauge },
  { label: "Providers", value: "9", detail: "hot-swappable", icon: RadioTower },
  { label: "Skills", value: "218+", detail: "auto-injected", icon: BrainCircuit },
  { label: "Sandbox", value: "Policy", detail: "approval gated", icon: ShieldCheck },
]

const PIPELINE = [
  "Repo scan",
  "Task split",
  "Agent swarm",
  "Patch plan",
  "Verify",
  "Ship",
]

export function Hero() {
  return (
    <section className="hero-cockpit">
      <div className="cockpit-grid-bg" aria-hidden="true" />
      <div className="cockpit-scanline" aria-hidden="true" />
      <div className="cockpit-warp-lines" aria-hidden="true" />

      <div className="hero-cockpit-inner">
        <m.div
          className="hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <div className="cockpit-kicker">
            <span className="signal-dot" />
            <span>Multi-agent engineering cockpit</span>
            <span className="kicker-divider" />
            <span>v1.1.5</span>
          </div>

          <h1>
            Command a full AI engineering crew from your terminal.
          </h1>

          <p>
            Aurict turns a local shell into a mission control surface: specialist agents split the task,
            run tools, check risk, verify patches, and keep provider choice under your control.
          </p>

          <div className="hero-actions">
            <a className="primary-action" href="#install">
              <Zap size={16} aria-hidden="true" />
              Launch the cockpit
            </a>
            <a className="secondary-action" href="/docs">
              <Terminal size={16} aria-hidden="true" />
              Read the flight manual
            </a>
            <code>npm install -g aurict</code>
          </div>
        </m.div>

        <m.div
          className="cockpit-shell"
          initial={{ opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.12 }}
        >
          <div className="cockpit-header">
            <div>
              <span className="cockpit-label">Aurict Control Deck</span>
              <strong>Parallel task runtime</strong>
            </div>
            <div className="cockpit-health">
              <Activity size={15} aria-hidden="true" />
              live
            </div>
          </div>

          <div className="cockpit-layout">
            <aside className="agent-rail" aria-label="Active agents">
              <div className="panel-title">
                <Boxes size={14} aria-hidden="true" />
                Agent swarm
              </div>
              <div className="agent-list">
                {AGENTS.map((agent, index) => (
                  <div className="agent-row" key={agent.name}>
                    <div className="agent-main">
                      <span className="agent-pulse" style={{ background: agent.color, animationDelay: `${index * 0.18}s` }} />
                      <div>
                        <strong>{agent.name}</strong>
                        <span>{agent.status}</span>
                      </div>
                    </div>
                    <div className="agent-load">
                      <span style={{ width: `${agent.load}%`, background: agent.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="portal-note">
                <Cpu size={14} aria-hidden="true" />
                Tiny portal anomaly contained in worker thread 04.
              </div>
            </aside>

            <div className="terminal-stage">
              <TerminalWindow />
            </div>

            <aside className="telemetry-rail" aria-label="Runtime telemetry">
              <div className="panel-title">
                <GitBranch size={14} aria-hidden="true" />
                Runtime telemetry
              </div>
              <div className="telemetry-grid">
                {TELEMETRY.map((item) => {
                  const Icon = item.icon
                  return (
                    <div className="telemetry-tile" key={item.label}>
                      <div>
                        <Icon size={15} aria-hidden="true" />
                        <span>{item.label}</span>
                      </div>
                      <strong>{item.value}</strong>
                      <small>{item.detail}</small>
                    </div>
                  )
                })}
              </div>
              <div className="risk-console">
                <span>GateGuard</span>
                <strong>dangerous command held</strong>
                <small>rm -rf request moved to approval orbit</small>
              </div>
            </aside>
          </div>

          <div className="pipeline-strip" aria-label="Task pipeline">
            {PIPELINE.map((step, index) => (
              <div className="pipeline-step" key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {step}
              </div>
            ))}
          </div>
        </m.div>
      </div>
    </section>
  )
}

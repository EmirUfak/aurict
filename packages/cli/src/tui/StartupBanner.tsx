/**
 * StartupBanner — Aurict başlangıç banner'ı (Cockpit v2)
 *
 * Responsive terminal cockpit:
 *  - Geniş terminaller "SYSTEMS ONLINE" instrument ızgaralı bir komuta paneli gösterir.
 *  - Dar terminaller aynı bilgiyi tek okunur sütunda tutar.
 *  - Metin özgün sci-fi mühendislik tonunda; dış slogan yok.
 */

import React from "react"
import { Text } from "ink"
import { HStack, VStack, Center } from "./design-system/index.js"
import { Eyebrow, motionEnabled } from "./design-system/index.js"
import { useTheme } from "../utils/theme.js"

// Wordmark satırları renksiz tanımlanır; renk, render sırasında aktif marka
// temasından üretilen bir gradyanla verilir (varsayılan: oxblood).
const ASCII_LOGO = [
  "  █████╗  ██╗   ██╗  ██████╗  ██╗  ██████╗  ████████╗",
  " ██╔══██╗ ██║   ██║  ██╔══██╗ ██║ ██╔════╝  ╚══██╔══╝",
  " ███████║ ██║   ██║  ██████╔╝ ██║ ██║          ██║   ",
  " ██╔══██║ ██║   ██║  ██╔══██╗ ██║ ██║          ██║   ",
  " ██║  ██║ ╚██████╔╝  ██║  ██║ ██║ ╚██████╗     ██║   ",
  " ╚═╝  ╚═╝  ╚═════╝   ╚═╝  ╚═╝ ╚═╝  ╚═════╝     ╚═╝   ",
]

// Dar terminaller için özel kompakt AURICT ASCII logo.
const COMPACT_ASCII_LOGO = [
  "  █   █ ███  ███ ███ ███ ███",
  " █ █  █ █  █  █  █   █    █ ",
  " ███  █ ███   █  █   █    █ ",
  " █ █  █ █ █   █  █   █    █ ",
  " █ █  █ █  █ ███ ███ ███  █ ",
]

// İki hex arası doğrusal renk interpolasyonu — marka gradyanı için.
function hexGradient(from: string, to: string, steps: number): string[] {
  const parse = (h: string): [number, number, number] => {
    const s = h.replace("#", "")
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = parse(from)
  const [r2, g2, b2] = parse(to)
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0")
  if (steps <= 1) return [from]
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    return `#${hex(r1 + (r2 - r1) * t)}${hex(g1 + (g2 - g1) * t)}${hex(b1 + (b2 - b1) * t)}`
  })
}

const SIGNAL_POOL = [
  "Command deck online. Keep the blast radius visible.",
  "Portal anomaly contained; patch route is stable.",
  "Compiler mood: skeptical, but negotiable.",
  "Run the smallest safe check before the dramatic rewrite.",
  "If the diff looks haunted, ask the review agent first.",
  "Telemetry is quiet. That usually means the logs are waiting.",
  "Sandbox field armed. Destructive commands need a real reason.",
  "Context loaded. Try a precise task and let the swarm split it.",
  "A clean commit is not a personality trait, but it helps.",
  "The fastest path is still the one with verification.",
]

const BOOT_PHASES = [
  "syncing workspace",
  "calibrating agents",
  "arming sandbox",
  "warming tool bus",
  "cockpit ready",
]

const PORTAL_FRAMES = [
  "◜══════◝",
  "═◜════◝═",
  "══◜══◝══",
  "══◟══◞══",
  "═◟════◞═",
  "◟══════◞",
]

interface Tip {
  label: string
  hint:  string
  tone:  "info" | "accent" | "warning" | "success" | "muted"
}

const TIP_POOL: Tip[] = [
  { label: "⌃X",        hint: "subagent view",       tone: "accent"  },
  { label: "⌃T",        hint: "task panel",          tone: "accent"  },
  { label: "⌃P",        hint: "command palette",     tone: "accent"  },
  { label: "⌃R",        hint: "history search",      tone: "muted"   },
  { label: "/design",   hint: "UI wizard",           tone: "info"    },
  { label: "/sessions", hint: "restore history",     tone: "info"    },
  { label: "/compact",  hint: "manage context",      tone: "warning" },
  { label: "/export",   hint: "save as markdown",    tone: "info"    },
  { label: "/btw",      hint: "background note",     tone: "info"    },
  { label: "/agents",   hint: "view subagents",      tone: "accent"  },
  { label: "/skills",   hint: "project skills",      tone: "info"    },
  { label: "/ctx",      hint: "token breakdown",     tone: "muted"   },
  { label: "autopilot", hint: "/config autopilot",   tone: "warning" },
]

// Deterministik 30 dakikalık seed tabanlı ipucu seçici
function seededPick(pool: Tip[], count: number): Tip[] {
  const seed  = Math.floor(Date.now() / (1000 * 60 * 30))
  const arr   = [...pool]
  let s = seed
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    const j = s % (i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr.slice(0, count)
}

interface Props {
  version:  string
  provider: string
  model:    string
  workdir:  string
  cols?:    number
  rows?:    number
}

// İki sütunlu instrument ızgarası için tek hücre
function Cell({ label, value, valueColor, labelColor, width }: {
  label: string; value: string; valueColor: string; labelColor: string; width: number
}) {
  const labelMax = 10
  const valueMax = Math.max(8, width - labelMax - 2)
  return (
    <HStack width={width} justify="space-between">
      <Text color={labelColor}>{truncate(label, labelMax)}</Text>
      <Text color={valueColor}>{truncate(value, valueMax)}</Text>
    </HStack>
  )
}

function SafeDivider({ color, width, label }: { color: string; width: number; label?: string | undefined }) {
  const safeWidth = Math.max(12, width)
  if (label) {
    const prefix = `── ${label} `
    return <Text color={color}>{prefix}{String("─").repeat(Math.max(0, safeWidth - prefix.length))}</Text>
  }
  return <Text color={color}>{String("─").repeat(safeWidth)}</Text>
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1))}…`
}

export function StartupBanner({ version, provider, model, workdir, cols, rows }: Props) {
  const theme = useTheme()
  const user  = process.env["USER"] || process.env["USERNAME"] || "user"
  const dir   = workdir.replace(process.env["HOME"] ?? "", "~")

  const tips = seededPick(TIP_POOL, 3)
  const isNarrow = cols !== undefined && cols < 85
  const isTiny = rows !== undefined && rows < 20
  const isShort = rows !== undefined && rows < 30
  const showFullLogo = (cols === undefined || cols >= 85) && !isShort
  const signal = React.useMemo(() => SIGNAL_POOL[Math.floor(Math.random() * SIGNAL_POOL.length)]!, [])
  const [bootFrame, setBootFrame] = React.useState(0)

  React.useEffect(() => {
    const maxFrame = BOOT_PHASES.length * 2 - 1
    if (!motionEnabled()) { setBootFrame(maxFrame); return }
    const t = setInterval(() => setBootFrame((n) => n >= maxFrame ? n : n + 1), 220)
    return () => clearInterval(t)
  }, [])

  const bootPhase = BOOT_PHASES[Math.min(BOOT_PHASES.length - 1, Math.floor(bootFrame / 2) % BOOT_PHASES.length)]!
  const portalFrame = PORTAL_FRAMES[bootFrame % PORTAL_FRAMES.length]!
  // Banner tam terminal genişliğini kaplar — üst bar ve input ile aynı kenar.
  const bannerWidth = Math.max(24, cols ?? 80)
  const outerContentWidth = Math.max(18, bannerWidth - 4)
  // Marka gradyanı: üstte accentAlt (açık), altta accent (koyu) — oxblood tonları.
  const logoColors = hexGradient(theme.accentAlt, theme.accent, ASCII_LOGO.length)
  const compactLogoColors = hexGradient(theme.accentAlt, theme.accent, COMPACT_ASCII_LOGO.length)
  const panelWidth = outerContentWidth
  const panelContentWidth = Math.max(18, panelWidth - 6)
  const dividerWidth = outerContentWidth
  const panelDividerWidth = panelContentWidth
  const shortDir = truncate(dir, Math.max(18, bannerWidth - 26))
  const narrowCellWidth = Math.max(30, outerContentWidth - 4)
  const wideCellWidth = Math.max(30, Math.floor((panelContentWidth - 3) / 2))

  if (isTiny) {
    return (
      <VStack width={bannerWidth} paddingX="md" paddingY="none" gap="none" borderStyle="round" borderColor={theme.borderDim}>
        <HStack justify="space-between">
          <Text color={theme.accentAlt} bold>AURICT {version}</Text>
          <Text color={theme.success}>● ready</Text>
        </HStack>
        <HStack justify="space-between">
          <Text color={theme.textDim}>{shortDir}</Text>
          <Text color={theme.textSecondary}>{truncate(model, 18)}</Text>
        </HStack>
      </VStack>
    )
  }

  if (isShort) {
    return (
      <VStack width={bannerWidth} paddingX="md" paddingY="xs" gap="none" borderStyle="round" borderColor={theme.borderDim}>
        <HStack justify="space-between">
          <Text color={theme.accentAlt} bold>AURICT {version}</Text>
          <Text color={theme.success}>● ready</Text>
        </HStack>
        <HStack justify="space-between">
          <Text color={theme.textDim}>{truncate(provider, 18)}</Text>
          <Text color={theme.textSecondary}>{truncate(model, Math.max(16, bannerWidth - 34))}</Text>
        </HStack>
        <Text color={theme.textDim}>{shortDir}</Text>
        <HStack justify="space-between">
          <Text color={theme.accent}>{portalFrame}</Text>
          <Text color={theme.textDim}>{bootPhase}</Text>
        </HStack>
        <Text color={theme.textDim}>/help · ⌃P palette · @ file</Text>
      </VStack>
    )
  }

  // ── Dar Ekran Düzeni (Tek Sütun) ──────────────────────────────────────────
  if (isNarrow) {
    return (
      <VStack width={bannerWidth} paddingX="md" paddingY="sm" gap="sm" borderStyle="round" borderColor={theme.borderDim}>
        <Center>
          <VStack gap="none">
            {COMPACT_ASCII_LOGO.map((row, i) => (
              <Text key={i} color={compactLogoColors[i] ?? theme.accent} bold>{row}</Text>
            ))}
          </VStack>
        </Center>
        <HStack justify="center" marginBottom="xs">
          <Text color={theme.accentAlt}>✦ AURICT {version}</Text>
        </HStack>

        <SafeDivider color={theme.borderDim} width={dividerWidth} label="systems online" />

        <VStack paddingX="sm" gap="none">
          <Cell label="provider" value={provider} valueColor={theme.textPrimary} labelColor={theme.textDim} width={narrowCellWidth} />
          <Cell label="model"    value={model}    valueColor={theme.textPrimary} labelColor={theme.textDim} width={narrowCellWidth} />
          <Cell label="project"  value={dir}      valueColor={theme.textPrimary} labelColor={theme.textDim} width={narrowCellWidth} />
        </VStack>

        <HStack justify="center" gap="sm">
          <Text color={theme.accent}>{portalFrame}</Text>
          <Text color={theme.textDim}>{bootPhase}</Text>
        </HStack>

        <SafeDivider color={theme.borderDim} width={dividerWidth} />

        <VStack paddingX="sm" gap="none">
          <Text color={theme.accentAlt}>◆ {signal}</Text>
          <Text color={theme.textDim} dimColor>engineering signal</Text>
        </VStack>

        <SafeDivider color={theme.borderDim} width={dividerWidth} />

        <VStack gap="none" paddingX="sm">
          <Text color={theme.textSecondary} bold>Welcome back, {user}</Text>
          <Text color={theme.textDim}>
            • <Text color={theme.accent} bold>/help</Text> — tüm komutlar & kısayollar
          </Text>
          {tips.slice(0, 2).map((tip, i) => (
            <Text key={i} color={theme.textDim}>
              • <Text color={theme.warning} bold>{tip.label}</Text> {tip.hint}
            </Text>
          ))}
        </VStack>
      </VStack>
    )
  }

  // ── Geniş Ekran Düzeni (komuta paneli) ──────────────────────────────────────
  return (
    <VStack width={bannerWidth} paddingX="md" paddingY="sm" gap="sm">
      {showFullLogo && (
        <Center>
          <VStack gap="none">
            {ASCII_LOGO.map((row, i) => (
              <Text key={i} color={logoColors[i] ?? theme.accent} bold>{row}</Text>
            ))}
          </VStack>
        </Center>
      )}

      <HStack justify="center" gap="sm">
        <Text color={theme.accentAlt}>✦</Text>
        <Text color={theme.textPrimary} bold>AURICT</Text>
        <Text color={theme.textDim}>· multi-agent cockpit</Text>
        <Text color={theme.accent}>✦</Text>
      </HStack>

      <HStack width={panelWidth} gap="none">
        <Text color={theme.borderActive}>┌</Text>
        <Text color={theme.textDim}> systems online </Text>
        <Text color={theme.borderActive}>{"─".repeat(Math.max(0, panelWidth - 18))}</Text>
      </HStack>
      <VStack width={panelWidth} borderStyle="round" borderColor={theme.borderActive} borderTop={false} paddingX="md" paddingY="sm" gap="xs">
        <HStack justify="space-between">
          <Eyebrow tone="muted">cockpit</Eyebrow>
          <Text color={theme.success}>◉ ready · {version}</Text>
        </HStack>
        <SafeDivider color={theme.borderDim} width={panelDividerWidth} />
        <HStack gap="lg">
          <Cell label="provider" value={provider}        valueColor={theme.textPrimary} labelColor={theme.textDim} width={wideCellWidth} />
          <Cell label="sandbox"  value="policy"          valueColor={theme.warning}     labelColor={theme.textDim} width={wideCellWidth} />
        </HStack>
        <HStack gap="lg">
          <Cell label="model"    value={model}           valueColor={theme.textPrimary} labelColor={theme.textDim} width={wideCellWidth} />
          <Cell label="agents"   value="swarm · 0 active" valueColor={theme.accentAlt}  labelColor={theme.textDim} width={wideCellWidth} />
        </HStack>
        <HStack gap="lg">
          <Cell label="project"  value={dir}             valueColor={theme.textPrimary} labelColor={theme.textDim} width={wideCellWidth} />
          <Cell label="status"   value="● online"        valueColor={theme.success}     labelColor={theme.textDim} width={wideCellWidth} />
        </HStack>
        <SafeDivider color={theme.borderDim} width={panelDividerWidth} />
        <HStack justify="space-between">
          <HStack gap="sm">
            <Text color={theme.accentAlt}>●</Text>
            <Text color={theme.textDim}>Ready — type </Text>
            <Text color={theme.accent} bold>/help</Text>
            <Text color={theme.textDim}> to begin</Text>
          </HStack>
          <HStack gap="sm">
            <Text color={theme.accent}>{portalFrame}</Text>
            <Text color={theme.textDim}>{bootPhase}</Text>
          </HStack>
        </HStack>
      </VStack>

      <HStack paddingX="sm" gap="sm">
        <Text color={theme.accentAlt}>◆</Text>
        <Text color={theme.textSecondary}>{signal}</Text>
        <Text color={theme.textDim} dimColor>· mission signal</Text>
      </HStack>

      <HStack justify="space-between" paddingX="sm">
        <Text color={theme.textDim}>Welcome back, {user}</Text>
        <HStack gap="md">
          {tips.map((tip, i) => (
            <Text key={i} color={theme.textDim}>
              <Text color={theme.warning} bold>{tip.label}</Text> {tip.hint}
            </Text>
          ))}
        </HStack>
      </HStack>

      <HStack width={panelWidth} gap="none">
        <Text color={theme.borderActive}>└</Text>
        <Text color={theme.borderActive}>{"─".repeat(Math.max(0, panelWidth - 2))}</Text>
      </HStack>
    </VStack>
  )
}

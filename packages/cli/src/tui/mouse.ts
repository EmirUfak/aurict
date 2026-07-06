/**
 * Mouse desteği — xterm escape sequence parser
 *
 * Terminal mouse raporlamasını etkinleştirir ve temel click/scroll event'lerini
 * parse eder. Ink'in useInput'u ile çakışmamak için raw stdin stream'ine
 * doğrudan listener eklenir.
 *
 * Desteklenen protokoller:
 *   - X10 (\x1b[M<b><x><y>)
 *   - SGR (\x1b[<n;n;nM ve \x1b[<n;n;nm)
 */

import { useEffect, useRef } from "react"
import { registerTerminalMode } from "./event-system/terminal-modes.js"

export type MouseButton = "left" | "right" | "middle" | "scroll-up" | "scroll-down"

export interface MouseEvent {
  type:   "click" | "release" | "scroll"
  button: MouseButton
  x:      number   // 1-based terminal column
  y:      number   // 1-based terminal row
}

type MouseHandler = (e: MouseEvent) => void

const handlers = new Set<MouseHandler>()
let enabled = false

// ── Terminal focus (DECSET 1004: CSI I / CSI O) ─────────────────────────────
// Odak sequence'ları da mouse sequence'ları gibi burada, TEK stdin-tap
// noktasında ayrıştırılır — ayrı bir modülün stdin.emit/read'i bağımsızca
// yeniden yaması, bu dosyanın zaten hassas olan coalesced-key-splitting ve
// pendingReads kuyruğu mantığıyla öngörülemeyen şekilde çakışabilirdi.
type FocusHandler = (focused: boolean) => void
const focusHandlers = new Set<FocusHandler>()
const FOCUS_SEQ_RE = /\x1b\[([IO])/g

function stripAndDispatchFocus(str: string): string {
  if (!str.includes("\x1b[I") && !str.includes("\x1b[O")) return str
  return str.replace(FOCUS_SEQ_RE, (_match, ch: string) => {
    const focused = ch === "I"
    for (const h of focusHandlers) h(focused)
    return ""
  })
}

// Installed at module load — strips mouse escape sequences from stdin before
// Ink's useInput sees them. Runs unconditionally so sequences are filtered
// even when the terminal or tmux enables mouse mode independently of Aurict,
// and even before the first React effect fires (which would otherwise leave a
// window where sequences leak through as garbage text).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _origStdinEmit = process.stdin.emit.bind(process.stdin) as (...a: any[]) => boolean
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(process.stdin as any).emit = (event: string | symbol, ...args: unknown[]): boolean => {
  if (event === "data") {
    const raw = args[0] as Buffer | string
    const str = typeof raw === "string" ? raw : raw.toString("binary")
    if (enabled) parseMouseEvents(str)
    const clean = stripAndDispatchFocus(
      str
        .replace(/\x1b\[<\d+;\d+;\d+[Mm]/g, "")  // SGR mouse events
        .replace(/\x1b\[M[\s\S]{3}/g, "")          // X10 mouse events (3 raw bytes)
    )
    if (!clean) return true
    return _origStdinEmit("data", Buffer.from(clean, "binary"))
  }
  return _origStdinEmit(event, ...args)
}

// ── stdin.read() interception ─────────────────────────────────────────────────
// Ink 5 tüketimi 'data' event'i ile DEĞİL, 'readable' + stdin.read() ile yapar.
// Bu yüzden asıl filtreleme/parçalama burada olmalı:
//
//   1. Mouse escape sequence'ları gerçek okuma yolundan da temizlenir
//      (yukarıdaki emit patch'i yalnızca flowing moddaki akışları yakalar).
//   2. Coalesced tuş dizileri ayrıştırılır: tuş basılı tutulduğunda terminal
//      "\x1b[B\x1b[B\x1b[B" gibi TEK chunk gönderir; Ink chunk başına yalnızca
//      BİR keypress parse eder ve kalan basışlar kaybolur (seçim listelerinde
//      "kayma"/takılma hissi). Chunk tamamen ≥2 navigasyon sequence'ından
//      oluşuyorsa tek tek kuyruklanır — Ink'in `while (read())` döngüsü her
//      çağrıda bir keypress alır, hiçbir basış kaybolmaz.
//   3. injectInput(): Ink'e programatik tuş göndermek için güvenilir yol
//      (mouse wheel → ok tuşu sentezi gibi). stdin.emit("data") readable
//      modda hiçbir listener'a ulaşmadığı için çalışmıyordu.
//
// Bracketed paste (\x1b[200~ ... \x1b[201~) navigasyon regex'iyle eşleşmediği
// için parçalanmaz; normal metin ve karışık chunk'lar da olduğu gibi geçer.

// Tek bir navigasyon/edit tuşunun escape sequence'ı:
//   CSI:  \x1b[A/B/C/D (ok), \x1b[H/F (home/end), \x1b[1;5C gibi modifierlı,
//         \x1b[3~ (del) \x1b[5~/6~ (pgup/pgdn) ve modifierlı \x1b[3;5~ türevleri
//   SS3:  \x1bOA..\x1bOD, \x1bOH/\x1bOF
const NAV_SEQ_RE = /\x1b(?:\[(?:\d+(?:;\d+)*)?(?:[ABCDHF]|~)|O[ABCDHF])/g

export function splitCoalescedKeys(chunk: string): string[] | null {
  if (chunk.length < 6 || chunk.charCodeAt(0) !== 0x1b) return null
  const tokens = chunk.match(NAV_SEQ_RE)
  if (!tokens || tokens.length < 2) return null
  if (tokens.join("") !== chunk) return null   // saf navigasyon chunk'ı değil
  return tokens
}

const pendingReads: string[] = []
const _origStdinRead = process.stdin.read.bind(process.stdin)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(process.stdin as any).read = (size?: number): unknown => {
  if (pendingReads.length > 0) return pendingReads.shift()!
  const raw = _origStdinRead(size)
  if (raw === null || raw === undefined) return raw
  const str = typeof raw === "string" ? raw : String(raw)
  if (enabled) parseMouseEvents(str)
  const clean = stripAndDispatchFocus(
    str
      .replace(/\x1b\[<\d+;\d+;\d+[Mm]/g, "")  // SGR mouse events
      .replace(/\x1b\[M[\s\S]{3}/g, "")          // X10 mouse events
  )
  if (!clean) return null
  const tokens = splitCoalescedKeys(clean)
  if (tokens) {
    pendingReads.push(...tokens.slice(1))
    return tokens[0]!
  }
  return clean
}

/**
 * Ink'e programatik tuş gönder — kuyruğa ekler ve 'readable' tetikleyerek
 * Ink'in read() döngüsünü çalıştırır. (stdin.emit("data") Ink 5'in
 * readable-mode tüketiminde hiçbir işleyiciye ulaşmaz.)
 */
export function injectInput(sequence: string): void {
  pendingReads.push(sequence)
  process.stdin.emit("readable")
}

function enableMouseTracking(): () => void {
  if (enabled) return () => {}
  enabled = true
  // Kayıt merkezi (terminal-modes.ts) SIGINT/SIGTERM/exit'te bu sequence'ların
  // yazıldığından emin olur — önceden yalnızca React effect unmount'una
  // güveniliyordu, süreç sinyalle sonlandığında hiç çalışmıyordu.
  const cleanup = registerTerminalMode(
    "mouse-tracking",
    "\x1b[?1000h\x1b[?1006h",  // normal button events + SGR mode
    "\x1b[?1006l\x1b[?1000l",
  )
  return () => {
    cleanup()
    enabled = false
  }
}

let focusModeCleanup: (() => void) | null = null

/**
 * Terminal odak değişikliklerini (DECSET 1004) dinle. İlk abone olan çağrı
 * `\x1b[?1004h`'ı etkinleştirir; son abone ayrılınca `\x1b[?1004l` ile
 * kapatılır (mouse tracking'deki ref-count deseniyle aynı).
 * @returns Aboneliği iptal eden fonksiyon.
 */
export function onFocusChange(handler: FocusHandler): () => void {
  if (focusHandlers.size === 0) {
    focusModeCleanup = registerTerminalMode("terminal-focus", "\x1b[?1004h", "\x1b[?1004l")
  }
  focusHandlers.add(handler)
  return () => {
    focusHandlers.delete(handler)
    if (focusHandlers.size === 0 && focusModeCleanup) {
      focusModeCleanup()
      focusModeCleanup = null
    }
  }
}

function parseMouseEvents(input: string): void {
  if (handlers.size === 0) return

  // SGR format: \x1b[<Pb;Px;PyM (press) or \x1b[<Pb;Px;Pym (release)
  const sgrRe = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g
  let m: RegExpExecArray | null
  while ((m = sgrRe.exec(input)) !== null) {
    const [, b, x, y, type] = m
    const button  = parseInt(b!, 10)
    const col     = parseInt(x!, 10)
    const row     = parseInt(y!, 10)
    const release = type === "m"
    const evt     = decodeSGRButton(button, col, row, release)
    if (evt) dispatch(evt)
  }

  // X10 format: \x1b[M<b><x><y>
  let i = 0
  while (i < input.length) {
    const esc = input.indexOf("\x1b[M", i)
    if (esc === -1 || esc + 5 > input.length) break
    const b = input.charCodeAt(esc + 3) - 32
    const x = input.charCodeAt(esc + 4) - 32
    const y = input.charCodeAt(esc + 5) - 32
    const evt = decodeX10Button(b, x, y)
    if (evt) dispatch(evt)
    i = esc + 6
  }
}

function decodeSGRButton(b: number, x: number, y: number, release: boolean): MouseEvent | null {
  const scrollBit = (b & 64) !== 0
  const btn       = b & 3
  if (scrollBit) {
    return { type: "scroll", button: btn === 0 ? "scroll-up" : "scroll-down", x, y }
  }
  const button: MouseButton = btn === 0 ? "left" : btn === 1 ? "middle" : "right"
  return { type: release ? "release" : "click", button, x, y }
}

function decodeX10Button(b: number, x: number, y: number): MouseEvent | null {
  if (b < 0 || x < 1 || y < 1) return null
  const scrollBit = (b & 64) !== 0
  const btn       = b & 3
  if (scrollBit) {
    return { type: "scroll", button: btn === 0 ? "scroll-up" : "scroll-down", x, y }
  }
  if (btn === 3) return { type: "release", button: "left", x, y }
  const button: MouseButton = btn === 0 ? "left" : btn === 1 ? "middle" : "right"
  return { type: "click", button, x, y }
}

function dispatch(evt: MouseEvent): void {
  for (const h of handlers) h(evt)
}

// ── React hook ────────────────────────────────────────────────────────────────

let cleanupFn: (() => void) | null = null

/**
 * Subscribe to mouse events.
 *
 * @param handler  Event callback.
 * @param active   When false, tracking is disabled and the terminal handles
 *                 scroll natively (user can scroll through output history).
 *                 Defaults to true only when a Picker/overlay is open.
 */
export function useMouseEvents(handler: MouseHandler, active = true): void {
  // Always keep ref up to date — runs after every render, no dep array.
  const handlerRef = useRef(handler)
  useEffect(() => { handlerRef.current = handler })

  // Stable forwarder: same reference for the lifetime of this hook instance.
  // Prevents mouse tracking from being torn down and re-enabled on every
  // App re-render (which happens on every streaming token), which was
  // writing 4 ANSI escape sequences to stdout per render and corrupting
  // the terminal output during streaming.
  const stableRef = useRef<MouseHandler | null>(null)
  if (stableRef.current === null) {
    stableRef.current = (e: MouseEvent) => handlerRef.current(e)
  }

  useEffect(() => {
    const stable = stableRef.current!
    if (!active) {
      if (handlers.has(stable)) {
        handlers.delete(stable)
        if (handlers.size === 0 && cleanupFn) { cleanupFn(); cleanupFn = null }
      }
      return
    }
    if (handlers.size === 0) cleanupFn = enableMouseTracking()
    handlers.add(stable)
    return () => {
      handlers.delete(stable)
      if (handlers.size === 0 && cleanupFn) { cleanupFn(); cleanupFn = null }
    }
  }, [active])
}

export function useMouseClick(
  button: MouseButton | MouseButton[],
  handler: (e: MouseEvent) => void,
): void {
  const buttons = Array.isArray(button) ? button : [button]
  useMouseEvents((e) => {
    if (e.type === "click" && buttons.includes(e.button)) handler(e)
  })
}

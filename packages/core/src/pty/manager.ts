// ─── PTY Manager ───────────────────────────────────────────────────────────
// Bun.spawn ile gerçek process yönetimi.
// node-pty gibi binary bağımlılığı yok — Bun native API kullanıyoruz.

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const MAX_BUFFER  = 2 * 1024 * 1024 // 2 MB ring buffer
const MAX_SESSION = 20               // maksimum eş zamanlı session

export interface PtySession {
  id:          string
  pid:         number
  command:     string
  args:        string[]
  cwd:         string
  status:      "running" | "exited"
  outputBuffer: string
  exitCode?:   number | undefined
  startedAt:   number
  outputChars: number
  ownerSessionId: string
}

interface InternalSession extends PtySession {
  proc: ReturnType<typeof Bun.spawn>
  readPromise: Promise<void>
  outputPath: string
  metadataPath: string
  writeChain: Promise<void>
}

interface PtyCreateOptions {
  inheritEnv?: boolean
  ownerSessionId?: string
}

class PtyManager {
  private sessions = new Map<string, InternalSession>()

  /** Yeni process başlat — stdout+stderr'ı buffer'a toplar */
  async create(
    command:  string,
    args:     string[] = [],
    cwd?:     string,
    env?:     Record<string, string>,
    options:  PtyCreateOptions = {},
  ): Promise<PtySession> {
    if (this.sessions.size >= MAX_SESSION) {
      // En eski exited session'ı temizle
      this.cleanup()
      if (this.sessions.size >= MAX_SESSION) {
        throw new Error(`Too many active terminal sessions (max ${MAX_SESSION})`)
      }
    }

    const id = crypto.randomUUID()
    const effectiveCwd = cwd ?? process.cwd()
    const outputPath = sessionOutputPath(effectiveCwd, id)
    const metadataPath = sessionMetadataPath(effectiveCwd, id)
    await mkdir(sessionDirectory(effectiveCwd), { recursive: true })

    const proc = Bun.spawn([command, ...args], {
      cwd:   effectiveCwd,
      env:   env
        ? (options.inheritEnv === false ? env : { ...process.env, ...env })
        : process.env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })

    const session: InternalSession = {
      id,
      pid:          proc.pid,
      command,
      args,
      cwd:          effectiveCwd,
      status:       "running",
      outputBuffer: "",
      startedAt:    Date.now(),
      outputChars:  0,
      ownerSessionId: options.ownerSessionId ?? "anonymous",
      proc,
      readPromise:  Promise.resolve(),
      outputPath,
      metadataPath,
      writeChain: Promise.resolve(),
    }
    await this.persistMetadata(session)

    // stdout + stderr okuma
    const appendOutput = (chunk: string) => {
      session.outputBuffer += chunk
      session.outputChars += chunk.length
      session.writeChain = session.writeChain.then(() => appendFile(session.outputPath, chunk, "utf8"))
      // Ring buffer: 2MB aşıldıysa başından kes
      if (session.outputBuffer.length > MAX_BUFFER) {
        session.outputBuffer = session.outputBuffer.slice(
          session.outputBuffer.length - MAX_BUFFER,
        )
      }
    }

    const readStream = async (stream: ReadableStream<Uint8Array> | null) => {
      if (!stream) return
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          appendOutput(decoder.decode(value, { stream: true }))
        }
        appendOutput(decoder.decode())
      } finally {
        reader.releaseLock()
      }
    }

    session.readPromise = Promise.all([
      readStream(proc.stdout),
      readStream(proc.stderr),
    ]).then(async () => {
      const code = await proc.exited
      session.status   = "exited"
      session.exitCode = code
      await session.writeChain
      await this.persistMetadata(session)
    }).catch(() => {
      session.status = "exited"
      void this.persistMetadata(session)
    })

    this.sessions.set(id, session)
    return this.toPublic(session)
  }

  /** Çalışan process'e stdin yaz */
  write(id: string, data: string): void {
    const s = this.sessions.get(id)
    if (!s || s.status !== "running") return
    if (s.proc.stdin && typeof s.proc.stdin !== 'number') {
      s.proc.stdin.write(data)
    }
  }

  /** Process'i sonlandır */
  kill(id: string): void {
    const s = this.sessions.get(id)
    if (!s) return
    try { s.proc.kill() } catch { /* sessiz kapat */ }
    s.status = "exited"
    void this.persistMetadata(s)
  }

  /** Session bilgisini döndür */
  get(id: string): PtySession | undefined {
    const s = this.sessions.get(id)
    return s ? this.toPublic(s) : undefined
  }

  /** Tüm session'ları listele */
  list(): PtySession[] {
    return [...this.sessions.values()].map((s) => this.toPublic(s))
  }

  /** Sonlanmış session'ları temizle */
  cleanup(): void {
    // Release only in-memory process handles. Completed sessions remain
    // addressable through their durable metadata and output files.
    for (const [id, session] of this.sessions) {
      if (session.status === "exited") this.sessions.delete(id)
    }
  }

  /** Process bitene kadar bekle (timeout ile) */
  async wait(id: string, timeoutMs: number): Promise<PtySession & { timedOut?: boolean }> {
    const s = this.sessions.get(id)
    if (!s) throw new Error(`Session not found: ${id}`)

    if (s.status === "exited") return this.toPublic(s)

    let done = false
    let resolveTimeout: (val: PtySession & { timedOut: boolean }) => void
    const timeoutPromise = new Promise<PtySession & { timedOut: boolean }>((res) => {
      resolveTimeout = res
    })

    const timer = setTimeout(() => {
      if (!done) {
        resolveTimeout({ ...this.toPublic(s), timedOut: true })
      }
    }, timeoutMs)

    const result = await Promise.race([
      s.readPromise.then(() => this.toPublic(s)),
      timeoutPromise
    ])

    done = true
    clearTimeout(timer)
    return result
  }

  async readOutput(id: string, cwd: string, ownerSessionId?: string): Promise<PtySession | undefined> {
    const live = this.sessions.get(id)
    if (live) {
      if (ownerSessionId && live.ownerSessionId !== ownerSessionId) return undefined
      await live.writeChain
      const output = await readFile(live.outputPath, "utf8").catch(() => live.outputBuffer)
      return { ...this.toPublic(live), outputBuffer: output }
    }
    if (!isSessionId(id)) return undefined
    try {
      const raw = await readFile(sessionMetadataPath(cwd, id), "utf8")
      const parsed = JSON.parse(raw) as PtySession
      if (ownerSessionId && parsed.ownerSessionId !== ownerSessionId) return undefined
      const output = await readFile(sessionOutputPath(cwd, id), "utf8").catch(() => "")
      return { ...parsed, outputBuffer: output }
    } catch {
      return undefined
    }
  }

  private async persistMetadata(s: InternalSession): Promise<void> {
    const record: PtySession = this.toPublic(s)
    await writeFile(s.metadataPath, JSON.stringify(record), "utf8")
  }

  private toPublic(s: InternalSession): PtySession {
    return {
      id:           s.id,
      pid:          s.pid,
      command:      s.command,
      args:         s.args.map(redactCommandArgument),
      cwd:          s.cwd,
      status:       s.status,
      outputBuffer: s.outputBuffer,
      exitCode:     s.exitCode,
      startedAt:    s.startedAt,
      outputChars:  s.outputChars,
      ownerSessionId: s.ownerSessionId,
    }
  }
}

export const ptyManager = new PtyManager()

function sessionDirectory(cwd: string): string {
  return join(cwd, ".aurict", "processes")
}

function sessionOutputPath(cwd: string, id: string): string {
  return join(sessionDirectory(cwd), `${id}.log`)
}

function sessionMetadataPath(cwd: string, id: string): string {
  return join(sessionDirectory(cwd), `${id}.json`)
}

function isSessionId(value: string): boolean {
  return /^[a-f0-9-]{36}$/i.test(value)
}

function redactCommandArgument(value: string): string {
  return value
    .replace(/((?:api[_-]?key|token|secret|password)\s*[=:]\s*)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/(Authorization:\s*Bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
}

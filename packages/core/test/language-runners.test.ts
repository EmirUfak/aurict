/**
 * Faz 4.1 — dile-agnostik doğrulama runner'ları.
 *
 * mypy/ruff/rubocop bu test ortamında KURULU DEĞİL (doğrulandı) — bu, "binary
 * kurulu değil → skipped" yolunu deterministik olarak test etmemizi sağlar.
 * ruby bu ortamda KURULU — `ruby -c` için gerçek geçme/kalma senaryosu
 * test edilir (ortamda yoksa it.skipIf ile atlanır, CI-bağımsız).
 */
import { describe, it, expect } from "bun:test"
import { extensionOf, runnersForExtension, runLanguageChecks } from "../src/verification/language-runners.js"
import { createTempDir } from "./helpers.js"

describe("extensionOf", () => {
  it("uzantıyı küçük harfe çevirerek döner", () => {
    expect(extensionOf("foo/bar.PY")).toBe(".py")
    expect(extensionOf("script.rb")).toBe(".rb")
  })
  it("uzantısız dosya için boş string döner", () => {
    expect(extensionOf("Makefile")).toBe("")
  })
})

describe("runnersForExtension", () => {
  it(".py için mypy (check) ve ruff (lint) tanımlıdır", () => {
    const specs = runnersForExtension(".py")
    expect(specs.map(s => s.checkId).sort()).toEqual(["mypy", "ruff"].sort())
    expect(specs.find(s => s.checkId === "mypy")?.tier).toBe("check")
    expect(specs.find(s => s.checkId === "ruff")?.tier).toBe("lint")
  })
  it(".go için sadece govet tanımlıdır", () => {
    expect(runnersForExtension(".go").map(s => s.checkId)).toEqual(["govet"])
  })
  it("bilinmeyen uzantı için boş dizi döner", () => {
    expect(runnersForExtension(".java")).toEqual([])
  })
})

describe("runLanguageChecks — binary kurulu değil (mypy/ruff/rubocop bu ortamda yok)", () => {
  it("mypy kurulu değilse 'check' tier yine de denenir ve skipped döner", async () => {
    const { dir, cleanup, createFile } = createTempDir()
    const file = createFile("a.py", "x = 1\n")
    try {
      const results = await runLanguageChecks(file, dir)
      const mypy = results.find(r => r.checkId === "mypy")
      expect(mypy?.status).toBe("skipped")
      expect(mypy?.reason).toContain("not installed")
    } finally {
      cleanup()
    }
  })

  it("autoLint verilmezse ruff (lint tier) hiç denenmez", async () => {
    const { dir, cleanup, createFile } = createTempDir()
    const file = createFile("a.py", "x = 1\n")
    try {
      const results = await runLanguageChecks(file, dir)
      expect(results.find(r => r.checkId === "ruff")).toBeUndefined()
    } finally {
      cleanup()
    }
  })

  it("autoLint:true iken ruff da denenir (kurulu değilse yine skipped)", async () => {
    const { dir, cleanup, createFile } = createTempDir()
    const file = createFile("a.py", "x = 1\n")
    try {
      const results = await runLanguageChecks(file, dir, { autoLint: true })
      const ruff = results.find(r => r.checkId === "ruff")
      expect(ruff).toBeDefined()
      expect(ruff?.status).toBe("skipped")
    } finally {
      cleanup()
    }
  })

  it("languages[ext]===false iken o uzantı için hiçbir check çalışmaz", async () => {
    const { dir, cleanup, createFile } = createTempDir()
    const file = createFile("a.py", "x = 1\n")
    try {
      const results = await runLanguageChecks(file, dir, { languages: { ".py": false } })
      expect(results).toEqual([])
    } finally {
      cleanup()
    }
  })

  it("bilinmeyen uzantı (.java) için boş dizi döner, crash etmez", async () => {
    const { dir, cleanup, createFile } = createTempDir()
    const file = createFile("a.java", "class A {}\n")
    try {
      const results = await runLanguageChecks(file, dir)
      expect(results).toEqual([])
    } finally {
      cleanup()
    }
  })
})

describe("runLanguageChecks — ruby -c (bu ortamda kurulu, gerçek çalıştırma)", () => {
  const rubyAvailable = !!Bun.which("ruby")

  it.skipIf(!rubyAvailable)("geçerli ruby syntax'i için passed döner", async () => {
    const { dir, cleanup, createFile } = createTempDir()
    const file = createFile("a.rb", "def foo\n  1 + 1\nend\n")
    try {
      const results = await runLanguageChecks(file, dir)
      const ruby = results.find(r => r.checkId === "ruby")
      expect(ruby?.status).toBe("passed")
    } finally {
      cleanup()
    }
  })

  it.skipIf(!rubyAvailable)("geçersiz ruby syntax'i için failed + hata çıktısı döner", async () => {
    const { dir, cleanup, createFile } = createTempDir()
    const file = createFile("a.rb", "def foo(\n  1 +\nend\n")
    try {
      const results = await runLanguageChecks(file, dir)
      const ruby = results.find(r => r.checkId === "ruby")
      expect(ruby?.status).toBe("failed")
      expect(ruby?.output).toBeTruthy()
    } finally {
      cleanup()
    }
  })
})

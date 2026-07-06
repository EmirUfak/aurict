/**
 * MultilineInput — Ctrl+Backspace/Ctrl+W/Alt+Backspace kelime-sil varyantları.
 *
 * `AURICT_DEBUG_KEYS=1` ile toplanan gerçek kullanıcı verisi (2026-07-06),
 * Ink'in `useInput`'a ulaşmadan ÖNCE bilinen escape sequence'ları kendi
 * key ve input çiftine çevirdiğini gösterdi — raw baytlar `input`'ta
 * SAKLANMIYOR. Bu, önceki 5 ham-string kontrolünün çoğunun pratikte HİÇBİR
 * ZAMAN tutmadığı anlamına geliyor:
 *   - gnome-terminal ailesinde Ctrl+Backspace/Alt+Backspace (\x1b\x7f) Ink
 *     tarafından {delete:true, meta:true, input:""} olarak veriliyor.
 *   - Ctrl+W (\x17) Ink tarafından her zaman {ctrl:true, input:"w"} olarak
 *     veriliyor — \x17 asla `input`'ta literal görünmüyor.
 *   - \x08 (Ctrl+Backspace, VTE-family) yalnızca {backspace:true} olarak
 *     geliyor — düz Backspace'ten AYIRT EDİLEMİYOR, bu yüzden düzeltilemez
 *     bir belirsizlik (Ink/terminal seviyesinde kayıp bilgi).
 *   - kitty CSI-u (\x1b[127;5u) ESC ve "[127;5u" olarak İKİ AYRI event'e
 *     bölünüyor, hiçbir zaman tek bir `input` string'i olarak birleşmiyor.
 * Yalnızca gerçekten çalışan iki yol burada test ediliyor; \x08/kitty CSI-u
 * için kaynaktaki ham-string kontrolleri yalnızca savunma amaçlı bırakıldı
 * (zararsız, ama şu an hiçbir gerçek terminal/Ink 5 kombinasyonunda
 * tetiklenmiyor) ve burada test edilmiyor.
 */
import React from "react"
import { describe, it, expect, afterEach } from "bun:test"
import { render, cleanup } from "ink-testing-library"
import { MultilineInput } from "../src/tui/MultilineInput.js"

afterEach(() => cleanup())

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

async function typeAndDeleteWord(deleteSeq: string): Promise<string> {
  let current = ""
  const { stdin } = render(
    <MultilineInput value="" onChange={(v) => { current = v }} onSubmit={() => {}} disabled={false} history={[]} />,
  )
  await flush()

  stdin.write("hello world")
  await flush()
  stdin.write(deleteSeq)
  await flush()

  cleanup()
  return current
}

describe("MultilineInput — word-delete variants (real Ink key parser)", () => {
  it("\\x1b\\x7f (Ctrl+Backspace on gnome-terminal family / Alt+Backspace) deletes the last word", async () => {
    expect(await typeAndDeleteWord("\x1b\x7f")).toBe("hello ")
  })

  it("\\x17 (Ctrl+W) deletes the last word", async () => {
    expect(await typeAndDeleteWord("\x17")).toBe("hello ")
  })
})

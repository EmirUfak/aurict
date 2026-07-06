import { reassertActiveModes } from "./terminal-modes.js"

/**
 * stdin'de bu süreden uzun bir sessizlik sonrası yeni veri gelirse, terminal
 * modlarının (mouse tracking, bracketed paste, ...) yeniden ilan edilmesi
 * gerektiği varsayılır — tmux detach/reattach, SSH bağlantı kopması veya
 * laptop uyku/uyanma gibi senaryolarda uzak terminal DEC private mode
 * durumunu sıfırlamış olabilir; Aurict tarafında hâlâ "etkin" sayılan bir
 * mod, gerçekte terminalde artık etkin olmayabilir.
 */
export const STDIN_RESUME_GAP_MS = 5000

let installed = false
let lastActivityAt = Date.now()

/** Saf karar fonksiyonu — testte gerçek zaman kaynağına ihtiyaç duymadan doğrulanır. */
export function shouldReassertModes(
  now: number,
  lastActivity: number,
  gapMs: number = STDIN_RESUME_GAP_MS,
): boolean {
  return now - lastActivity > gapMs
}

/**
 * stdin aktivite izleyicisini kurar. Ink 5, stdin'i 'readable' + `read()` ile
 * (paused mode) tükettiği için buraya bir 'data' listener'ı EKLEMİYORUZ —
 * 'data' listener'ı eklemek stream'i flowing mode'a geçirir ve Ink'in manuel
 * `read()` döngüsüyle çakışır. 'readable' listener'ı paused mode'u bozmaz.
 *
 * @returns Kaldırma (uninstall) fonksiyonu.
 */
export function installStdinResumeGuard(now: () => number = Date.now): () => void {
  if (installed) return () => {}
  installed = true
  lastActivityAt = now()

  const onActivity = (): void => {
    const current = now()
    if (shouldReassertModes(current, lastActivityAt)) {
      reassertActiveModes()
    }
    lastActivityAt = current
  }

  process.stdin.on("readable", onActivity)
  return () => {
    process.stdin.off("readable", onActivity)
    installed = false
  }
}

/** Yalnızca testler için: modül-seviyeli durumu sıfırlar. */
export function __resetForTest(): void {
  installed = false
  lastActivityAt = Date.now()
}

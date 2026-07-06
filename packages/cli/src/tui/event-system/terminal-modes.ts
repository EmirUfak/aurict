/**
 * Merkezi terminal modu kayıt defteri.
 *
 * Terminale "mod açma" escape sequence'ı yazan her özellik (bracketed paste,
 * mouse tracking, focus reporting, ...) enable/disable çiftini burada
 * kaydeder. Süreç SIGINT/SIGTERM/exit ile sonlanırken (React effect
 * cleanup'larının çalışacağı garanti değildir — Ink'in `exit()`'i veya
 * sinyal tabanlı sonlanma senkron cleanup'ı atlayabilir) bu modül HER
 * kayıtlı modun disable sequence'ını yazar.
 *
 * Neden gerekli: Ctrl+C (SIGINT) ile çıkışta bracketed paste kapatma
 * sequence'ı hiç yazılmıyordu (yalnızca "exit"/"SIGTERM" dinleniyordu) —
 * bir sonraki terminal oturumunda `\x1b[200~`/`\x1b[201~` görünür çöp metin
 * olarak sızabiliyordu. Mouse tracking'in ise hiç process-seviyeli
 * cleanup'ı yoktu, yalnızca React effect unmount'una güveniyordu.
 */

interface ModeEntry {
  enable:  string
  disable: string
}

const activeModes = new Map<string, ModeEntry>()
let signalsRegistered = false

function restoreAll(): void {
  for (const { disable } of activeModes.values()) {
    try { process.stdout.write(disable) } catch { /* stdout zaten kapanmış olabilir */ }
  }
  activeModes.clear()
}

function ensureSignalHandlers(): void {
  if (signalsRegistered) return
  signalsRegistered = true
  process.on("exit", restoreAll)
  process.on("SIGINT", restoreAll)
  process.on("SIGTERM", restoreAll)
}

/**
 * Bir terminal modunu etkinleştirir ve kaydeder.
 * @param id Modun benzersiz kimliği (ör. "mouse-tracking", "bracketed-paste").
 * @param enableSequence  Terminale hemen yazılacak açma sequence'ı.
 * @param disableSequence Normal kapanışta veya süreç sonlanırken yazılacak sequence.
 * @returns Modu kapatan ve kayıttan düşüren bir temizleme fonksiyonu (React
 *          effect cleanup'ında çağrılır; normal yoldan kapanırsa süreç
 *          sonlanırken tekrar yazılmaz).
 */
export function registerTerminalMode(
  id: string,
  enableSequence: string,
  disableSequence: string,
): () => void {
  ensureSignalHandlers()
  process.stdout.write(enableSequence)
  activeModes.set(id, { enable: enableSequence, disable: disableSequence })

  let cleaned = false
  return () => {
    if (cleaned) return
    cleaned = true
    activeModes.delete(id)
    try { process.stdout.write(disableSequence) } catch { /* ignore */ }
  }
}

/** Şu anda etkin olan modların id → disable-sequence eşlemesi (yalnızca okuma). */
export function getActiveModes(): ReadonlyMap<string, string> {
  const projected = new Map<string, string>()
  for (const [id, entry] of activeModes) projected.set(id, entry.disable)
  return projected
}

/**
 * Şu anda etkin olan tüm modların enable sequence'larını terminale yeniden
 * yazar. tmux detach/reattach veya SSH kopması sonrası uzak terminalin mod
 * durumu sıfırlanmış olabilir — stdin'de uzun bir sessizlik sonrası veri
 * geldiğinde bu fonksiyon çağrılarak mouse tracking/bracketed paste gibi
 * modların tekrar etkin olduğundan emin olunur.
 */
export function reassertActiveModes(): void {
  for (const { enable } of activeModes.values()) {
    try { process.stdout.write(enable) } catch { /* ignore */ }
  }
}

/** Yalnızca testler için: modül-seviyeli durumu sıfırlar. */
export function __resetForTest(): void {
  activeModes.clear()
  signalsRegistered = false
  process.off("exit", restoreAll)
  process.off("SIGINT", restoreAll)
  process.off("SIGTERM", restoreAll)
}

/** Yalnızca testler için: sinyal göndermeden restoreAll'u tetikler. */
export function __triggerRestoreForTest(): void {
  restoreAll()
}

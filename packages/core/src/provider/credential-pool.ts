/**
 * Çoklu API key rotasyonu — rate-limit dağıtımı için round-robin havuz.
 *
 * Bir provider için birden fazla API key tanımlandığında (ör. ekip/kurumsal
 * kullanım, ayrı rate-limit kotalarını birleştirme), istekleri sırayla
 * dağıtır ve rate-limit/hata durumunda geçici olarak devre dışı bırakır.
 *
 * Davranış:
 *  - `next()` → imleçten başlayarak devre dışı veya cooldown'da OLMAYAN ilk
 *    key'i döner; hiçbiri uygun değilse en son başarısız olandan en uzun
 *    süre geçmiş olana (soğuması en yakın) düşer.
 *  - `reportFailure(lease, "auth", ...)` → key kalıcı olarak devre dışı
 *    bırakılır (yanlış/iptal edilmiş key — tekrar denemenin anlamı yok).
 *  - `reportFailure(lease, "cooldown", ms)` → key `ms` süreyle soğumaya
 *    alınır (429 rate-limit gibi geçici hatalar).
 *  - `reportSuccess(lease)` → key'in cooldown'unu temizler (erken kurtarma).
 *
 * `CredentialLease.index`, `reportFailure`/`reportSuccess` çağrısının doğru
 * slotu güncellediğinden emin olmak için `next()` çağrısındaki key değeriyle
 * birlikte taşınır (aynı değer havuzda tekrar etse bile doğru slotu bulur).
 */

export type CredentialFailureKind = "auth" | "cooldown"

export interface CredentialLease {
  value: string
  index: number
}

interface CredentialState {
  value:         string
  disabled:      boolean
  cooldownUntil: number
  lastFailureAt: number
}

export class CredentialPool {
  private credentials: CredentialState[]
  private cursor = 0
  private readonly now: () => number

  constructor(values: string[], now: () => number = Date.now) {
    if (values.length === 0) throw new Error("CredentialPool: en az bir key gerekli")
    this.credentials = values.map((value) => ({
      value,
      disabled:      false,
      cooldownUntil: 0,
      lastFailureAt: 0,
    }))
    this.now = now
  }

  next(): CredentialLease {
    const n = this.credentials.length
    const t = this.now()

    for (let i = 0; i < n; i++) {
      const index = (this.cursor + i) % n
      const cred = this.credentials[index]!
      if (cred.disabled) continue
      if (cred.cooldownUntil > t) continue
      this.cursor = (index + 1) % n
      return { value: cred.value, index }
    }

    // Hepsi devre dışı/cooldown'da — en az kötü seçeneğe düş: en son
    // başarısız olandan en uzun süre geçmiş, devre dışı olmayan slot.
    let fallback = -1
    for (let index = 0; index < n; index++) {
      const cred = this.credentials[index]!
      if (cred.disabled) continue
      if (fallback === -1 || cred.lastFailureAt < this.credentials[fallback]!.lastFailureAt) {
        fallback = index
      }
    }
    if (fallback === -1) throw new Error("CredentialPool: kullanılabilir key yok (hepsi kalıcı devre dışı)")
    this.cursor = (fallback + 1) % n
    return { value: this.credentials[fallback]!.value, index: fallback }
  }

  reportFailure(lease: CredentialLease, kind: CredentialFailureKind, cooldownMs = 0): void {
    const cred = this.resolve(lease)
    if (!cred) return
    cred.lastFailureAt = this.now()
    if (kind === "auth") {
      cred.disabled = true
    } else {
      cred.cooldownUntil = this.now() + cooldownMs
    }
  }

  reportSuccess(lease: CredentialLease): void {
    const cred = this.resolve(lease)
    if (!cred) return
    cred.cooldownUntil = 0
  }

  size(): number {
    return this.credentials.length
  }

  private resolve(lease: CredentialLease): CredentialState | undefined {
    const cred = this.credentials[lease.index]
    return cred?.value === lease.value ? cred : undefined
  }
}

/** `"key1,key2,key3"` → `["key1", "key2", "key3"]`; boş girdileri ve baştaki/sondaki boşlukları eler. */
export function parseCredentialList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

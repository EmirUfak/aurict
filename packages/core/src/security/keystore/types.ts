/**
 * OS-level secure storage — minimum surface.
 *
 * Stajda API key'leri düz dosyada (`~/.aurict/config.json` veya JSON içinde)
 * saklamak yerine OS'un native credential deposuna yazmak için tek,
 * platform-bağımsız bir arayüz.
 *
 * Davranış:
 *  - `get(key)` → depoda yoksa `null` döner; hata fırlatmaz (fallback zinciri
 *    için).
 *  - `set(key, value)` → değeri saklar; depo erişilemezse `false` döner
 *    (yüksek seviye bunu dosyaya fallback eder).
 *  - `delete(key)` → kayıt yoksa sessizce `true` döner.
 *  - `available()` → depo gerçekten erişilebilir mi? (CLI'nın runtime'da
 *    check edip doctor'a basması için).
 *
 * `key` provider id'nin lower-case adı (`anthropic`, `openai`, ...) ya da
 * genel scope (`anthropic:default` gibi). OS implementasyonu bunu
 * platform-specific account name'e eşler.
 *
 * Agnostik tutmak için her platform implementasyonu yalnızca Node.js
 * built-in'lerini kullanır (`child_process`, `fs`, `os`) — ek native dep
 * gerekmez. Eğer bağımlılık mevcut değilse (`secret-tool` Linux'ta),
 * `available()` `false` döner ve yüksek seviye plain fallback'e geçer.
 */

export interface KeyStore {
  available(): Promise<boolean>
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<boolean>
  delete(key: string): Promise<boolean>
}

export const KEYSTORE_SERVICE = "aurict"

export type KeystoreBackend =
  | "macos-keychain"
  | "windows-credential"
  | "linux-secret-service"
  | "plain-file"
  | "none"

export interface KeystoreCapability {
  backend:   KeystoreBackend
  label:     string
  available: boolean
  reason:    string | undefined
}
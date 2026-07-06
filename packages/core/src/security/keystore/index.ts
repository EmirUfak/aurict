import type { KeyStore, KeystoreCapability } from "./types.js"
import { macosKeychain, macosKeystoreCapability } from "./macos.js"
import { windowsCredential, windowsKeystoreCapability } from "./windows.js"
import { linuxSecretService, linuxKeystoreCapability } from "./linux.js"
import { plainFile, plainKeystoreCapability } from "./plain.js"

export type { KeyStore, KeystoreCapability, KeystoreBackend } from "./types.js"
export { KEYSTORE_SERVICE } from "./types.js"
export { macosKeychain, windowsCredential, linuxSecretService, plainFile }

export function getKeystore(
  forced?: "macos-keychain" | "windows-credential" | "linux-secret-service" | "plain-file",
): KeyStore {
  if (forced === "macos-keychain") return macosKeychain
  if (forced === "windows-credential") return windowsCredential
  if (forced === "linux-secret-service") return linuxSecretService
  if (forced === "plain-file") return plainFile

  switch (process.platform) {
    case "darwin":  return macosKeychain
    case "win32":   return windowsCredential
    case "linux":   return linuxSecretService
    default:        return plainFile
  }
}

export async function detectKeystore(): Promise<KeystoreCapability> {
  const platform = process.platform

  let primary: Promise<KeystoreCapability>
  if (platform === "darwin")      primary = macosKeystoreCapability()
  else if (platform === "win32")  primary = windowsKeystoreCapability()
  else if (platform === "linux")  primary = linuxKeystoreCapability()
  else return plainKeystoreCapability()

  const cap = await primary.catch((): KeystoreCapability => ({
    backend: "none", label: "no keystore", available: false, reason: "probe failed",
  }))

  if (cap.available) return cap
  const fallback = await plainKeystoreCapability()
  if (fallback.available) return fallback
  return {
    backend:   "none",
    label:     "no keystore",
    available: false,
    reason:    cap.reason ?? fallback.reason,
  }
}

export function normalizeKeystoreKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
}

async function resolveStore(): Promise<KeyStore> {
  const native = getKeystore()
  if (await native.available().catch(() => false)) return native
  return plainFile
}

export async function loadApiKeyFromKeystore(providerId: string): Promise<string | null> {
  const store = await resolveStore()
  return store.get(normalizeKeystoreKey(providerId)).catch(() => null)
}

export async function saveApiKeyToKeystore(providerId: string, value: string): Promise<boolean> {
  const store = await resolveStore()
  return store.set(normalizeKeystoreKey(providerId), value).catch(() => false)
}

export async function deleteApiKeyFromKeystore(providerId: string): Promise<boolean> {
  const store = await resolveStore()
  return store.delete(normalizeKeystoreKey(providerId)).catch(() => false)
}
/**
 * Remote — CLI cihaz kimliği (Ed25519 imzalama anahtarı).
 *
 * Mobil ile bit-uyumlu sözleşme (mobile/lib/remote/mobile_device_identity.dart):
 *   - signingPublicKey: JWK STRING → {"kty":"OKP","crv":"Ed25519","x":<base64url>,"ext":true,"key_ops":["verify"]}
 *   - signingKeyFingerprint: "fp_" + base64url(sha256(utf8(jwkString)))
 *   - encryptionPublicKey: şimdilik signingPublicKey ile aynı (backend de böyle bekliyor)
 *   - imza: base64url(ed25519_sign(utf8(payload))) — ham Ed25519 imzası, JWS değil
 *
 * Backend (`apps/backend/src/crypto/signatures.ts`) `signingPublicKey`'i doğrudan
 * `crypto.subtle.importKey("jwk", ...)` ile parse edip doğruluyor — bu yüzden burada
 * üretilen JWK, backend'in de çalıştığı WebCrypto (Bun) ile üretilir/saklanır/imzalanır.
 * Doğrulandı: bkz. Ed25519 generate→export→sign→import→verify round-trip probe'u.
 */

import { backendRequest, RemoteApiError } from "./backend-client.js"
import { ensureAccessToken } from "./auth.js"
import { readStoredTokens } from "./session-store.js"
import { readSecureJson, writeSecureJson, deleteSecureFile } from "./secure-store.js"

const IDENTITY_FILE = "device.json"

// tsconfig lib'i "ES2022" (DOM yok) olduğu için ambient `JsonWebKey` tipi mevcut
// değil — Ed25519 JWK'nin kullandığımız alanları için yerel, minimal bir tip.
export interface Ed25519Jwk {
  kty:      string
  crv:      string
  x:        string
  d?:       string
  ext?:     boolean
  key_ops?: string[]
}

interface StoredIdentity {
  deviceId:              string
  privateJwk:            Ed25519Jwk
  publicJwk:             string   // wire format (JSON string) — kayıtta gönderilen değerin aynısı
  signingKeyFingerprint: string
  verified:              boolean
  /** Kaydın yapıldığı hesap — aynı makinede farklı bir hesapla giriş yapılırsa
   *  (userId uyuşmazsa) bu kimlik yeniden kullanılmaz, yeniden kayıt denenir. */
  registeredForUserId?:  string
}

export interface DeviceIdentity {
  deviceId:              string
  signingPublicKey:      string
  encryptionPublicKey:   string
  signingKeyFingerprint: string
  verified:              boolean
}

interface KeyMaterial {
  privateJwk:  Ed25519Jwk
  publicJwk:   string
  fingerprint: string
}

function toWireJwk(x: string): string {
  return JSON.stringify({ kty: "OKP", crv: "Ed25519", x, ext: true, key_ops: ["verify"] })
}

async function fingerprintOf(wireJwkStr: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(wireJwkStr))
  return `fp_${Buffer.from(digest).toString("base64url")}`
}

async function generateKeyMaterial(): Promise<KeyMaterial> {
  const keyPair    = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey) as Ed25519Jwk
  if (!privateJwk.x) throw new Error("Ed25519 key export did not include the public component.")
  const publicJwk  = toWireJwk(privateJwk.x)  // private JWK'nin "x" alanı = public key
  const fingerprint = await fingerprintOf(publicJwk)
  return { privateJwk, publicJwk, fingerprint }
}

/** Verilen ham metni (UTF8) saklı özel anahtarla imzalar; base64url imza döner. */
export async function signPayload(privateJwk: Ed25519Jwk, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "Ed25519" }, false, ["sign"])
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, key, new TextEncoder().encode(payload))
  return Buffer.from(sig).toString("base64url")
}

function deviceName(): string {
  return `Aurict CLI (${process.platform})`
}

function toPublicIdentity(stored: StoredIdentity): DeviceIdentity {
  return {
    deviceId:              stored.deviceId,
    signingPublicKey:      stored.publicJwk,
    encryptionPublicKey:   stored.publicJwk,
    signingKeyFingerprint: stored.signingKeyFingerprint,
    verified:              stored.verified,
  }
}

async function registerAndVerify(material: KeyMaterial, accessToken: string, userId: string | undefined): Promise<StoredIdentity> {
  const registered = await backendRequest<{
    device:       { id: string }
    verification: { challenge: string; expiresAt: string; algorithms: string[] }
  }>("/devices/register", {
    method: "POST",
    accessToken,
    body: {
      name:                  deviceName(),
      platform:              "cli",
      encryptionPublicKey:   material.publicJwk,
      signingPublicKey:      material.publicJwk,
      signingKeyFingerprint: material.fingerprint,
    },
  })

  const signature = await signPayload(material.privateJwk, registered.verification.challenge)
  const verified = await backendRequest<{ device: { id: string; verifiedAt?: string } }>(
    `/devices/${registered.device.id}/verify`,
    { method: "POST", accessToken, body: { challenge: registered.verification.challenge, signature, algorithm: "ed25519" } },
  )

  return {
    deviceId:              registered.device.id,
    privateJwk:            material.privateJwk,
    publicJwk:             material.publicJwk,
    signingKeyFingerprint: material.fingerprint,
    verified:              !!verified.device.verifiedAt,
    ...(userId !== undefined ? { registeredForUserId: userId } : {}),
  }
}

/**
 * Cihaz kimliğini garanti eder: yerelde doğrulanmış VE aynı hesaba ait bir kimlik
 * varsa onu döner; yoksa (ilk çalıştırma, hesap değişimi, veya önceki kayıt yarım
 * kalmışsa) anahtar üretir/yeniden kullanır, backend'e kaydeder ve challenge
 * imzalayarak doğrular.
 *
 * Aynı makinede farklı bir hesapla giriş yapılırsa (`registeredForUserId` uyuşmaz)
 * eski anahtar yeniden kullanılmaz — doğrudan taze anahtar üretilir (aksi halde
 * fingerprint zaten eski hesaba kayıtlı olduğundan gereksiz bir `device_exists`
 * round-trip'i yaşanırdı). `device_exists` (ör. config dizini silinip anahtar
 * kaybedildiğinde eski kayıt backend'de asılı kalması) durumunda da taze bir
 * anahtarla bir kez daha dener.
 */
export async function ensureDeviceIdentity(): Promise<DeviceIdentity> {
  const currentUserId = readStoredTokens()?.userId
  const stored = readSecureJson<StoredIdentity>(IDENTITY_FILE)
  const sameAccount = stored !== null && stored.registeredForUserId === currentUserId
  if (stored?.verified && sameAccount) return toPublicIdentity(stored)

  const accessToken = await ensureAccessToken()
  const material = stored && sameAccount
    ? { privateJwk: stored.privateJwk, publicJwk: stored.publicJwk, fingerprint: stored.signingKeyFingerprint }
    : await generateKeyMaterial()

  try {
    const identity = await registerAndVerify(material, accessToken, currentUserId)
    writeSecureJson(IDENTITY_FILE, identity)
    return toPublicIdentity(identity)
  } catch (error) {
    if (error instanceof RemoteApiError && error.code === "device_exists") {
      const fresh = await generateKeyMaterial()
      const identity = await registerAndVerify(fresh, accessToken, currentUserId)
      writeSecureJson(IDENTITY_FILE, identity)
      return toPublicIdentity(identity)
    }
    throw error
  }
}

export function readDeviceIdentity(): DeviceIdentity | null {
  const stored = readSecureJson<StoredIdentity>(IDENTITY_FILE)
  return stored ? toPublicIdentity(stored) : null
}

/** Uzaktan-oturum imzalamaları (offer/answer/event) için saklı özel anahtarla imzalar. */
export async function signWithStoredIdentity(payload: string): Promise<string> {
  const stored = readSecureJson<StoredIdentity>(IDENTITY_FILE)
  if (!stored) throw new Error("No device identity found. Call ensureDeviceIdentity() first.")
  return signPayload(stored.privateJwk, payload)
}

export function clearDeviceIdentity(): void {
  deleteSecureFile(IDENTITY_FILE)
}

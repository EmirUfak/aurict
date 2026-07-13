"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale } from "next-intl"
import { Link } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, LoaderCircle, Terminal, XCircle } from "lucide-react"
import { BrandMark } from "@/components/BrandMark"

type DeviceStatus = "checking" | "ready" | "approving" | "denying" | "approved" | "denied" | "error"
type User = { id: string; email: string }
type DeviceActionResponse = {
  ok: boolean
  status?: "approved" | "denied"
  clientName?: string
  expiresAt?: string
  error?: { message?: string }
}

export function DeviceLogin() {
  const tr = useLocale() === "tr"
  const search = useSearchParams()
  const userCode = useMemo(
    () => normalizeUserCode(search.get("user_code") ?? search.get("userCode") ?? search.get("code") ?? ""),
    [search],
  )
  const [status, setStatus] = useState<DeviceStatus>("checking")
  const [user, setUser] = useState<User | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [clientName, setClientName] = useState("Aurict CLI")

  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      if (!userCode) {
        setMessage(tr ? "CLI giriş kodu eksik." : "CLI login code is missing.")
        setStatus("error")
        return
      }

      setStatus("checking")
      setMessage(null)
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        const body = await response.json().catch(() => undefined)

        if (cancelled) return
        if (response.status === 401) {
          window.location.assign(nextHref("/login", currentPath()))
          return
        }
        if (!response.ok || !body?.ok) {
          throw new Error(body?.error?.message ?? (tr ? "Oturumunuz doğrulanamadı." : "Could not verify your session."))
        }

        setUser(body.user)
        setStatus("ready")
      } catch (error) {
        if (cancelled) return
        setMessage(error instanceof Error ? error.message : (tr ? "Oturumunuz doğrulanamadı." : "Could not verify your session."))
        setStatus("error")
      }
    }

    void checkSession()
    return () => {
      cancelled = true
    }
  }, [tr, userCode])

  async function submit(decision: "approve" | "deny") {
    if (!userCode || status === "approving" || status === "denying") return

    setStatus(decision === "approve" ? "approving" : "denying")
    setMessage(null)
    try {
      const body = await postDevice(`/api/auth/device/${decision}`, { userCode }, tr)
      if (!body.ok) throw new Error(body.error?.message ?? (tr ? `CLI girişi ${decision === "approve" ? "onaylanamadı" : "reddedilemedi"}.` : `Could not ${decision} CLI login.`))
      if (body.clientName) setClientName(body.clientName)
      setStatus(decision === "approve" ? "approved" : "denied")
      setMessage(decision === "approve" ? (tr ? "CLI girişi onaylandı." : "CLI login approved.") : (tr ? "CLI girişi reddedildi." : "CLI login denied."))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (tr ? `CLI girişi ${decision === "approve" ? "onaylanamadı" : "reddedilemedi"}.` : `Could not ${decision} CLI login.`))
      setStatus("ready")
    }
  }

  const busy = status === "checking" || status === "approving" || status === "denying"
  const complete = status === "approved" || status === "denied"

  return (
    <div className="auth-shell">
      <div className="auth-panel auth-device-panel marketing-card">
        <BrandMark size="auth" />

        <div className="auth-device-icon" aria-hidden="true">
          {status === "approved" ? <CheckCircle2 size={22} /> : status === "denied" ? <XCircle size={22} /> : <Terminal size={22} />}
        </div>

        <p className="marketing-eyebrow">{tr ? "CLI tarayıcı girişi" : "CLI browser login"}</p>
        <h1 className="marketing-title marketing-title-sm" style={{ marginBottom: 12 }}>
          {tr ? "Bu terminali yetkilendirin." : "Authorize this terminal."}
        </h1>
        <p className="marketing-lede" style={{ fontSize: 16, marginBottom: 24 }}>
          {complete ? (tr ? "Terminalinize dönebilirsiniz." : "You can return to your terminal.") : (tr ? "Tarayıcınızdaki kodun Aurict CLI'ın gösterdiği kodla eşleştiğini doğrulayın." : "Confirm that the code in your browser matches the code shown by Aurict CLI.")}
        </p>

        <div className="auth-device-code" aria-label={tr ? "CLI giriş kodu" : "CLI login code"}>
          {userCode || (tr ? "KOD YOK" : "NO CODE")}
        </div>

        {user && (
          <div className="auth-device-meta">
            <span>{tr ? "giriş yapan" : "signed in as"}</span>
            <strong>{user.email}</strong>
          </div>
        )}

        <div className={`auth-device-status auth-device-status-${status}`} role={status === "error" ? "alert" : "status"}>
          {busy && <LoaderCircle className="auth-spin" size={15} />}
          {message ?? statusLabel(status, clientName, tr)}
        </div>

        {!complete && status !== "error" && (
          <div className="auth-device-actions">
            <button
              className="landing-button-primary mono"
              disabled={busy}
              onClick={() => submit("approve")}
              type="button"
            >
              {status === "approving" ? <LoaderCircle className="auth-spin" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
              {tr ? "onayla" : "approve"}
            </button>
            <button
              className="auth-danger-button mono"
              disabled={busy}
              onClick={() => submit("deny")}
              type="button"
            >
              {status === "denying" ? <LoaderCircle className="auth-spin" size={16} /> : <XCircle aria-hidden="true" size={16} />}
              {tr ? "reddet" : "deny"}
            </button>
          </div>
        )}

        {complete && (
          <Link className="auth-muted-link mono" href="/">
            {tr ? "aurict'e dön" : "back to aurict"}
          </Link>
        )}

        {status === "error" && (
          <Link className="auth-muted-link mono" href={nextHref("/login", currentPath())}>
            {tr ? "giriş yapıp tekrar deneyin" : "sign in and try again"}
          </Link>
        )}
      </div>
    </div>
  )
}

async function postDevice(path: string, body: unknown, tr: boolean) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

  if (response.status === 401) {
    window.location.assign(nextHref("/login", currentPath()))
    return { ok: false, error: { message: tr ? "Oturumunuzun süresi doldu." : "Session expired." } } satisfies DeviceActionResponse
  }

  return response.json().catch(() => ({
    ok: false,
    error: { message: tr ? "Geçersiz sunucu yanıtı." : "Invalid server response." },
  })) as Promise<DeviceActionResponse>
}

function normalizeUserCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase()
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}`
}

function nextHref(path: string, nextPath: string) {
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/"
  return safeNext === "/" ? path : `${path}?next=${encodeURIComponent(safeNext)}`
}

function statusLabel(status: DeviceStatus, clientName: string, tr: boolean) {
  if (status === "checking") return tr ? "Oturumunuz denetleniyor..." : "Checking your session..."
  if (status === "approving") return tr ? "CLI girişi onaylanıyor..." : "Approving CLI login..."
  if (status === "denying") return tr ? "CLI girişi reddediliyor..." : "Denying CLI login..."
  if (status === "approved") return tr ? `${clientName} yetkilendirildi.` : `${clientName} is authorized.`
  if (status === "denied") return tr ? "Bu CLI giriş isteği reddedildi." : "This CLI login request was denied."
  if (status === "error") return tr ? "CLI girişine devam edilemedi." : "Could not continue CLI login."
  return tr ? "Kararınız bekleniyor." : "Waiting for your decision."
}

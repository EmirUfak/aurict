"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
        setMessage("CLI login code is missing.")
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
          throw new Error(body?.error?.message ?? "Could not verify your session.")
        }

        setUser(body.user)
        setStatus("ready")
      } catch (error) {
        if (cancelled) return
        setMessage(error instanceof Error ? error.message : "Could not verify your session.")
        setStatus("error")
      }
    }

    void checkSession()
    return () => {
      cancelled = true
    }
  }, [userCode])

  async function submit(decision: "approve" | "deny") {
    if (!userCode || status === "approving" || status === "denying") return

    setStatus(decision === "approve" ? "approving" : "denying")
    setMessage(null)
    try {
      const body = await postDevice(`/api/auth/device/${decision}`, { userCode })
      if (!body.ok) throw new Error(body.error?.message ?? `Could not ${decision} CLI login.`)
      if (body.clientName) setClientName(body.clientName)
      setStatus(decision === "approve" ? "approved" : "denied")
      setMessage(decision === "approve" ? "CLI login approved." : "CLI login denied.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not ${decision} CLI login.`)
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

        <p className="marketing-eyebrow">CLI browser login</p>
        <h1 className="marketing-title marketing-title-sm" style={{ marginBottom: 12 }}>
          Authorize this terminal.
        </h1>
        <p className="marketing-lede" style={{ fontSize: 16, marginBottom: 24 }}>
          {complete ? "You can return to your terminal." : "Confirm that the code in your browser matches the code shown by Aurict CLI."}
        </p>

        <div className="auth-device-code" aria-label="CLI login code">
          {userCode || "NO CODE"}
        </div>

        {user && (
          <div className="auth-device-meta">
            <span>signed in as</span>
            <strong>{user.email}</strong>
          </div>
        )}

        <div className={`auth-device-status auth-device-status-${status}`} role={status === "error" ? "alert" : "status"}>
          {busy && <LoaderCircle className="auth-spin" size={15} />}
          {message ?? statusLabel(status, clientName)}
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
              approve
            </button>
            <button
              className="auth-danger-button mono"
              disabled={busy}
              onClick={() => submit("deny")}
              type="button"
            >
              {status === "denying" ? <LoaderCircle className="auth-spin" size={16} /> : <XCircle aria-hidden="true" size={16} />}
              deny
            </button>
          </div>
        )}

        {complete && (
          <Link className="auth-muted-link mono" href="/">
            back to aurict
          </Link>
        )}

        {status === "error" && (
          <Link className="auth-muted-link mono" href={nextHref("/login", currentPath())}>
            sign in and try again
          </Link>
        )}
      </div>
    </div>
  )
}

async function postDevice(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

  if (response.status === 401) {
    window.location.assign(nextHref("/login", currentPath()))
    return { ok: false, error: { message: "Session expired." } } satisfies DeviceActionResponse
  }

  return response.json().catch(() => ({
    ok: false,
    error: { message: "Invalid server response." },
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

function statusLabel(status: DeviceStatus, clientName: string) {
  if (status === "checking") return "Checking your session..."
  if (status === "approving") return "Approving CLI login..."
  if (status === "denying") return "Denying CLI login..."
  if (status === "approved") return `${clientName} is authorized.`
  if (status === "denied") return "This CLI login request was denied."
  if (status === "error") return "Could not continue CLI login."
  return "Waiting for your decision."
}

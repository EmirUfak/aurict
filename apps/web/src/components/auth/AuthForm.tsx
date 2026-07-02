"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react"
import { BrandMark } from "@/components/BrandMark"

type AuthMode = "login" | "register"
type AuthProvider = {
  addScope?(scope: string): void
}
type FirebaseAuthFactory = {
  (): {
    signInWithPopup(provider: unknown): Promise<{ user: { getIdToken(): Promise<string> } }>
  }
  GoogleAuthProvider: new () => AuthProvider
  GithubAuthProvider: new () => AuthProvider
}

type FirebaseNamespace = {
  apps: unknown[]
  initializeApp(config: Record<string, string>): unknown
  auth: FirebaseAuthFactory
}

declare global {
  interface Window {
    firebase?: FirebaseNamespace
  }
}

const FIREBASE_APP_SCRIPT = "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
const FIREBASE_AUTH_SCRIPT = "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"

export function AuthForm({ mode }: { mode: AuthMode }) {
  const search = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<"password" | "google" | "github" | null>(null)

  const nextPath = useMemo(() => sanitizeNextPath(search.get("next")), [search])
  const isRegister = mode === "register"

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading("password")
    try {
      const result = await postAuth(isRegister ? "/api/auth/register" : "/api/auth/login", {
        email: email.trim(),
        password,
      })
      if (!result.ok) throw new Error(result.error?.message ?? "Authentication failed.")
      window.location.assign(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.")
    } finally {
      setLoading(null)
    }
  }

  async function submitProvider(provider: "google" | "github") {
    setError(null)
    setLoading(provider)
    try {
      const firebase = await loadFirebase()
      const authProvider = provider === "google"
        ? new firebase.auth.GoogleAuthProvider()
        : new firebase.auth.GithubAuthProvider()
      if (provider === "google") {
        authProvider.addScope?.("email")
        authProvider.addScope?.("profile")
      } else {
        authProvider.addScope?.("read:user")
        authProvider.addScope?.("user:email")
      }
      const credential = await firebase.auth().signInWithPopup(authProvider)
      const idToken = await credential.user.getIdToken()
      const result = await postAuth("/api/auth/firebase", { idToken })
      if (!result.ok) throw new Error(result.error?.message ?? "Provider login failed.")
      window.location.assign(nextPath)
    } catch (err) {
      setError(readFirebaseError(err))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel marketing-card">
        <BrandMark size="auth" />
        <p className="marketing-eyebrow">{isRegister ? "Create account" : "Welcome back"}</p>
        <h1 className="marketing-title marketing-title-sm" style={{ marginBottom: 12 }}>
          {isRegister ? "Start with Aurict." : "Sign in to Aurict."}
        </h1>
        <p className="marketing-lede" style={{ fontSize: 16, marginBottom: 28 }}>
          {isRegister
            ? "Use one account across the website, mobile app, and CLI browser login."
            : "Continue to your Aurict account, approve CLI login requests, and manage connected devices."}
        </p>

        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          <ProviderButton
            disabled={loading !== null}
            icon={loading === "google" ? <LoaderCircle className="auth-spin" size={16} /> : <span className="auth-google-mark">G</span>}
            label={isRegister ? "Sign up with Google" : "Sign in with Google"}
            loading={loading === "google"}
            onClick={() => submitProvider("google")}
          />
          <ProviderButton
            disabled={loading !== null}
            icon={loading === "github" ? <LoaderCircle className="auth-spin" size={16} /> : <span className="auth-github-mark">GH</span>}
            label={isRegister ? "Sign up with GitHub" : "Sign in with GitHub"}
            loading={loading === "github"}
            onClick={() => submitProvider("github")}
          />
        </div>

        <div className="auth-divider"><span>or use email</span></div>

        <form onSubmit={submitPassword} style={{ display: "grid", gap: 14 }}>
          <label className="auth-label">
            email
            <span className="auth-input-wrap">
              <Mail aria-hidden="true" size={16} />
              <input
                autoComplete="email"
                className="auth-input"
                inputMode="email"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </span>
          </label>
          <label className="auth-label">
            password
            <span className="auth-input-wrap">
              <LockKeyhole aria-hidden="true" size={16} />
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="auth-input"
                maxLength={1024}
                minLength={isRegister ? 10 : 1}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegister ? "minimum 10 characters" : "your password"}
                required
                type="password"
                value={password}
              />
            </span>
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="landing-button-primary mono" disabled={loading !== null} style={{ justifyContent: "center", marginTop: 4 }} type="submit">
            {loading === "password" ? (
              <>
                <LoaderCircle className="auth-spin" size={16} />
                working...
              </>
            ) : (
              <>
                {isRegister ? "create account" : "sign in"}
                <ArrowRight aria-hidden="true" size={16} />
              </>
            )}
          </button>
        </form>

        <p className="mono" style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 22, textAlign: "center" }}>
          {isRegister ? "Already have an account?" : "New to Aurict?"}{" "}
          <Link href={isRegister ? nextHref("/login", nextPath) : nextHref("/register", nextPath)} style={{ color: "var(--accent)", textDecoration: "none" }}>
            {isRegister ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>
    </div>
  )
}

function ProviderButton({
  disabled,
  icon,
  label,
  loading,
  onClick,
}: {
  disabled: boolean
  icon: React.ReactNode
  label: string
  loading: boolean
  onClick(): void
}) {
  return (
    <button
      aria-busy={loading}
      className="auth-provider-button"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true">{icon}</span>
      {loading ? "Opening provider..." : label}
    </button>
  )
}

async function postAuth(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({ ok: false, error: { message: "Invalid server response." } }))
  return json as { ok: boolean; error?: { message?: string } }
}

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/"
  return value
}

function nextHref(path: string, nextPath: string) {
  return nextPath === "/" ? path : `${path}?next=${encodeURIComponent(nextPath)}`
}

async function loadFirebase() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error("Firebase web auth is not configured.")
  }

  await loadScript(FIREBASE_APP_SCRIPT)
  await loadScript(FIREBASE_AUTH_SCRIPT)
  const firebase = window.firebase
  if (!firebase) throw new Error("Firebase auth failed to load.")
  if (firebase.apps.length === 0) firebase.initializeApp(config as Record<string, string>)
  return firebase
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing?.dataset.loaded === "true") {
      resolve()
      return
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Failed to load Firebase auth.")), { once: true })
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => {
      script.dataset.loaded = "true"
      resolve()
    }
    script.onerror = () => reject(new Error("Failed to load Firebase auth."))
    document.head.appendChild(script)
  })
}

function readFirebaseError(error: unknown) {
  if (isFirebaseClientError(error)) {
    if (error.code === "auth/popup-closed-by-user") return "Sign-in popup was closed."
    if (error.code === "auth/popup-blocked") return "Popup was blocked by the browser."
    if (error.code === "auth/account-exists-with-different-credential") {
      return "An account already exists with a different sign-in method."
    }
    if (typeof error.message === "string" && error.message) return error.message
  }
  if (error instanceof Error) {
    if (error.message.includes("popup-closed-by-user")) return "Sign-in popup was closed."
    if (error.message.includes("popup-blocked")) return "Popup was blocked by the browser."
    return error.message
  }
  return "Provider login failed."
}

function isFirebaseClientError(error: unknown): error is { code?: string; message?: string } {
  return typeof error === "object" && error !== null
}

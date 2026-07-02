"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, LogOut, MonitorCog, UserRound } from "lucide-react"

type AuthUser = {
  id: string
  email: string
  createdAt: string
}

type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "user"; user: AuthUser }

export function AuthNavSlot({ drawer = false }: { drawer?: boolean }) {
  const [state, setState] = useState<AuthState>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        const body = await response.json().catch(() => undefined)
        if (cancelled) return
        if (response.ok && body?.ok && body.user) {
          setState({ status: "user", user: body.user as AuthUser })
        } else {
          setState({ status: "guest" })
        }
      } catch {
        if (!cancelled) setState({ status: "guest" })
      }
    }
    void loadUser()
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status !== "user") {
    return drawer ? (
      <>
        <Link href="/login">login</Link>
        <Link href="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>register</Link>
      </>
    ) : (
      <>
        <a className="mono landing-nav-link" href="/login">login</a>
        <a className="mono landing-primary-link" href="/register">register →</a>
      </>
    )
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    window.location.assign("/")
  }

  if (drawer) {
    return (
      <>
        <span className="nav-drawer-label">account</span>
        <Link href="/console">console</Link>
        <Link href="/console/account">account</Link>
        <button className="nav-drawer-button" onClick={signOut} type="button">sign out</button>
      </>
    )
  }

  return (
    <div className="nav-dropdown profile-menu">
      <button className="profile-trigger" type="button">
        <span className="profile-avatar" aria-hidden="true">{initials(state.user.email)}</span>
        <span className="profile-email">{state.user.email}</span>
        <ChevronDown aria-hidden="true" size={13} />
      </button>
      <div className="nav-dropdown-menu profile-menu-panel">
        <Link className="nav-dropdown-item profile-menu-item" href="/console">
          <MonitorCog aria-hidden="true" size={14} />
          console
        </Link>
        <Link className="nav-dropdown-item profile-menu-item" href="/console/account">
          <UserRound aria-hidden="true" size={14} />
          account
        </Link>
        <button className="nav-dropdown-item profile-menu-item profile-menu-button" onClick={signOut} type="button">
          <LogOut aria-hidden="true" size={14} />
          sign out
        </button>
      </div>
    </div>
  )
}

function initials(email: string) {
  const name = email.split("@")[0] || "A"
  return name.slice(0, 2).toUpperCase()
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"

const STORAGE_KEY = "aurict:icarus-intro:v1"
const PREVIEW_ROUTE = "/intro-preview"

type IcarusIntroProps = {
  force?: boolean
  onDone?: () => void
}

export function IcarusIntro({ force = false, onDone }: IcarusIntroProps) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(force)
  const [exiting, setExiting] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const close = useCallback(() => {
    if (!force) {
      try {
        localStorage.setItem(STORAGE_KEY, "seen")
      } catch {
        // Ignore storage failures; the intro should never block the page.
      }
    }

    setExiting(true)
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, 500)
  }, [force, onDone])

  useEffect(() => {
    if (force || pathname?.startsWith(PREVIEW_ROUTE)) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    try {
      if (reducedMotion || localStorage.getItem(STORAGE_KEY)) return
    } catch {
      if (reducedMotion) return
    }

    const frame = window.requestAnimationFrame(() => setVisible(true))
    const timer = window.setTimeout(close, 5400)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [close, force, pathname])

  useEffect(() => {
    if (!force || !visible) return

    const timer = window.setTimeout(close, 5400)
    return () => window.clearTimeout(timer)
  }, [close, force, visible])

  useEffect(() => {
    if (!visible) {
      document.documentElement.classList.remove("aur-intro-lock")
      return
    }

    document.documentElement.classList.add("aur-intro-lock")
    return () => document.documentElement.classList.remove("aur-intro-lock")
  }, [visible])

  if (!visible) return null

  return (
    <div className={`icarus-intro ${exiting ? "icarus-intro-exit" : ""}`} aria-label="Aurict opening animation" role="dialog">
      <button className="icarus-skip mono" type="button" onClick={close}>
        skip intro
      </button>

      <div className="icarus-scene" aria-hidden="true">
        <div className="icarus-grid" />
        <div className="icarus-horizon" />
        <div className="icarus-sun" />
        <div className="icarus-orbit icarus-orbit-a" />
        <div className="icarus-orbit icarus-orbit-b" />
        <div className="icarus-orbit icarus-orbit-c" />

        <svg className="icarus-wings" viewBox="0 0 640 360" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="introWing" x1="110" y1="70" x2="530" y2="280" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FF3355" />
              <stop offset="1" stopColor="#6E0B1C" />
            </linearGradient>
            <linearGradient id="introGold" x1="180" y1="70" x2="480" y2="280" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#F0B75F" stopOpacity=".9" />
              <stop offset="1" stopColor="#D8625C" stopOpacity=".25" />
            </linearGradient>
          </defs>

          <path className="icarus-path icarus-path-soft" d="M318 242 C248 202 176 156 96 112" />
          <path className="icarus-path icarus-path-soft icarus-delay-a" d="M322 242 C392 202 464 156 544 112" />
          <path className="icarus-path" d="M318 238 C258 184 218 130 198 78" />
          <path className="icarus-path icarus-delay-a" d="M322 238 C382 184 422 130 442 78" />
          <path className="icarus-path icarus-delay-b" d="M248 202 C226 172 202 146 166 122" />
          <path className="icarus-path icarus-delay-c" d="M392 202 C414 172 438 146 474 122" />
          <path className="icarus-spine" d="M286 286 L318 198 Q322 184 328 198 L356 286" />
          <path className="icarus-core" d="M278 286 C300 248 312 222 320 198 C328 222 340 248 362 286" />
          <rect className="icarus-cursor-block" x="374" y="252" width="10" height="32" rx="1.5" />
        </svg>

        <div className="icarus-chip icarus-chip-a mono">TDD</div>
        <div className="icarus-chip icarus-chip-b mono">SECURITY</div>
        <div className="icarus-chip icarus-chip-c mono">ORCHESTRATION</div>
        <div className="icarus-chip icarus-chip-d mono">CONTEXT CONTROL</div>

        <div className="icarus-copy">
          <p className="icarus-line icarus-line-a mono">ICARUS FELL BECAUSE THE WINGS WERE FRAGILE</p>
          <p className="icarus-line icarus-line-b mono">AURICT REBUILDS THE ASCENT</p>
        </div>

        <div className="icarus-final-logo">
          <div className="icarus-logo-mark">
            <Image alt="" height={92} priority src="/aurict-logo-v5.svg" width={92} />
          </div>
          <div className="icarus-brand mono">aurict<span>█</span></div>
        </div>
      </div>
    </div>
  )
}

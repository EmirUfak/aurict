"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useLocale } from "next-intl"
import { usePathname } from "next/navigation"

const measurementId = "G-FJ9YLY6NMX"
const consentStorageKey = "aurict:analytics-consent"
const consentChangeEvent = "aurict:analytics-consent-change"
const googleTagId = "aurict-google-tag"

type Consent = "granted" | "denied"
type AnalyticsEventParameters = Record<string, string | number | boolean>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const copy = {
  en: {
    label: "Cookie preference",
    title: "Help us understand what works.",
    body: "Allow analytics and we will measure pages and interactions to improve Aurict. Decline and no analytics cookie is stored; Google receives only a cookieless, aggregate visit signal.",
    necessary: "Keep essential only",
    accept: "Allow analytics",
    privacy: "Privacy policy",
    statusOn: "Analytics on",
    statusOff: "Essential only",
    change: "Change cookie preference",
  },
  tr: {
    label: "Çerez tercihi",
    title: "Neyin işe yaradığını anlamamıza yardımcı ol.",
    body: "İzin verirsen Aurict'i iyileştirmek için ziyaret edilen sayfaları ve etkileşimleri ölçeriz. Reddedersen analitik çerezi yazılmaz; Google yalnızca çerezsiz, toplu bir ziyaret sinyali alır.",
    necessary: "Yalnızca gerekli",
    accept: "Analitiğe izin ver",
    privacy: "Gizlilik politikası",
    statusOn: "Analitik açık",
    statusOff: "Yalnızca gerekli",
    change: "Çerez tercihini değiştir",
  },
} as const

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(args)
}

function bootstrapGoogleTag() {
  if (window.gtag) return

  window.gtag = gtag
  window.gtag("js", new Date())
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  window.gtag("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    anonymize_ip: true,
    send_page_view: false,
  })
  const savedConsent = readConsent()
  if (savedConsent) window.gtag("consent", "update", { analytics_storage: savedConsent })

  const script = document.createElement("script")
  script.id = googleTagId
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.append(script)
}

function readConsent(): Consent | null {
  const value = window.localStorage.getItem(consentStorageKey)
  return value === "granted" || value === "denied" ? value : null
}

export function trackAnalyticsEvent(name: string, parameters: AnalyticsEventParameters) {
  if (readConsent() !== "granted") return
  window.gtag?.("event", name, { ...parameters, transport_type: "beacon" })
}

function subscribeToConsent(onStoreChange: () => void) {
  window.addEventListener(consentChangeEvent, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(consentChangeEvent, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

function subscribeToHydration() {
  return () => undefined
}

export function AnalyticsConsent() {
  const locale = useLocale() === "tr" ? "tr" : "en"
  const pathname = usePathname()
  const consent = useSyncExternalStore(subscribeToConsent, readConsent, () => null)
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const t = copy[locale]

  useEffect(() => {
    bootstrapGoogleTag()
  }, [])

  useEffect(() => {
    if (!hydrated || !pathname || !window.gtag) return

    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: pathname,
      page_title: document.title,
    })
  }, [hydrated, pathname])

  function choose(nextConsent: Consent) {
    window.localStorage.setItem(consentStorageKey, nextConsent)
    window.gtag?.("consent", "update", { analytics_storage: nextConsent })
    window.dispatchEvent(new Event(consentChangeEvent))
    setPreferencesOpen(false)
  }

  if (!hydrated) return null

  const open = consent === null || preferencesOpen
  return (
    <div className="analytics-consent" aria-live="polite">
      {open && (
        <section aria-describedby="analytics-consent-copy" aria-label={t.label} className="analytics-consent-card" role="dialog">
          <p className="analytics-consent-eyebrow mono">{t.label} <span aria-hidden="true">/</span> GA4</p>
          <h2>{t.title}</h2>
          <p id="analytics-consent-copy">{t.body}</p>
          <div className="analytics-consent-actions">
            <button className="analytics-consent-secondary" onClick={() => choose("denied")} type="button">
              {t.necessary}
            </button>
            <button className="analytics-consent-primary" onClick={() => choose("granted")} type="button">
              {t.accept}
            </button>
          </div>
          <a href="/privacy">{t.privacy}</a>
        </section>
      )}
      {consent !== null && !preferencesOpen && (
        <button aria-label={t.change} className="analytics-consent-trigger mono" onClick={() => setPreferencesOpen(true)} type="button">
          <span aria-hidden="true" className="analytics-consent-status" data-enabled={consent === "granted"} />
          {consent === "granted" ? t.statusOn : t.statusOff}
        </button>
      )}
    </div>
  )
}

"use client"

type AuthProvider = {
  addScope?(scope: string): void
}

type FirebaseAuthFactory = {
  (): {
    currentUser?: { getIdToken(forceRefresh?: boolean): Promise<string> } | null
    signInWithPopup(provider: unknown): Promise<{ user: { getIdToken(forceRefresh?: boolean): Promise<string> } }>
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

export async function loadFirebase() {
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

export function firebaseProvider(firebase: FirebaseNamespace, provider: "google" | "github") {
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
  return authProvider
}

export function readFirebaseError(error: unknown) {
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

function isFirebaseClientError(error: unknown): error is { code?: string; message?: string } {
  return typeof error === "object" && error !== null
}

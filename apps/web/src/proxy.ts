import { NextRequest, NextResponse } from "next/server"
import type { AppLocale } from "./i18n/routing"

const localeCookie = "AURICT_LOCALE"

function preferredLocale(request: NextRequest): AppLocale {
  const savedLocale = request.cookies.get(localeCookie)?.value
  if (savedLocale === "en" || savedLocale === "tr") return savedLocale

  return request.headers.get("accept-language")?.toLowerCase().startsWith("tr") ? "tr" : "en"
}

function rewriteWithLocale(request: NextRequest, pathname: string, locale: AppLocale) {
  const url = request.nextUrl.clone()
  const headers = new Headers(request.headers)
  headers.set("x-next-intl-locale", locale)
  url.pathname = pathname

  const response = NextResponse.rewrite(url, { request: { headers } })
  response.cookies.set(localeCookie, locale, { sameSite: "lax", path: "/" })
  return response
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = preferredLocale(request)
  const isEnglishPath = pathname === "/en" || pathname.startsWith("/en/")
  const isTurkishPath = pathname === "/tr" || pathname.startsWith("/tr/")

  if (isEnglishPath) {
    const url = request.nextUrl.clone()
    url.pathname = pathname === "/en" ? "/" : pathname.slice(3)
    const response = NextResponse.redirect(url)
    response.cookies.set(localeCookie, "en", { sameSite: "lax", path: "/" })
    return response
  }

  if (isTurkishPath) {
    const destination = pathname === "/tr" ? "/" : pathname.slice(3)
    return rewriteWithLocale(request, destination, "tr")
  }

  if (locale === "tr") {
    const url = request.nextUrl.clone()
    url.pathname = `/tr${pathname}`
    const response = NextResponse.redirect(url)
    response.cookies.set(localeCookie, "tr", { sameSite: "lax", path: "/" })
    return response
  }

  return rewriteWithLocale(request, pathname, "en")
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
}

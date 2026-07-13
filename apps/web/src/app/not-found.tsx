import { getLocale } from "next-intl/server"
import { BrandMark } from "@/components/BrandMark"
import { Link } from "@/i18n/navigation"
import type { AppLocale } from "@/i18n/routing"

export default async function NotFound() {
  const locale = await getLocale() as AppLocale
  const tr = locale === "tr"

  return (
    <main className="lost-route" aria-labelledby="lost-route-title">
      <div className="lost-route-top"><BrandMark compact /></div>
      <div className="lost-route-mark" aria-hidden="true">
        <span className="lost-route-wing lost-route-wing-left" />
        <span className="lost-route-core">▊</span>
        <span className="lost-route-wing lost-route-wing-right" />
      </div>
      <div className="lost-route-copy">
        <p className="lost-route-signal mono">aurict ▊</p>
        <h1 id="lost-route-title">{tr ? "Haritanın dışında." : "Beyond the map."}</h1>
      </div>
      <nav aria-label={tr ? "Rota seçenekleri" : "Route options"} className="lost-route-actions">
        <Link href="/">{tr ? "geri dön" : "go back"}</Link>
        <Link href="/docs">{tr ? "başka bir yol seç" : "choose another path"}</Link>
      </nav>
    </main>
  )
}

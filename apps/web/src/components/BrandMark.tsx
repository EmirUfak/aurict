import Image from "next/image"
import { Link } from "@/i18n/navigation"

type BrandMarkProps = {
  compact?: boolean
  href?: string
  size?: "nav" | "auth"
}

export function BrandMark({ compact = false, href = "/", size = "nav" }: BrandMarkProps) {
  const content = (
    <>
      <span className={`brand-logo-shell brand-logo-shell-${size}`} aria-hidden="true">
        <Image
          alt=""
          className="brand-logo"
          height={size === "auth" ? 58 : compact ? 28 : 32}
          priority
          src="/aurict-logo-v5.svg"
          width={size === "auth" ? 58 : compact ? 28 : 32}
        />
      </span>
      <span className={`brand-word brand-word-${size} mono`}>
        aurict<span className="aur-cursor" style={{ color: "var(--accent)" }}>▊</span>
      </span>
    </>
  )

  if (!href) {
    return <span className="brand-lockup">{content}</span>
  }

  return (
    <Link className={`brand-lockup brand-lockup-${size}`} href={href}>
      {content}
    </Link>
  )
}

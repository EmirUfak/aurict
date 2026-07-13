"use client"

import type { ComponentProps } from "react"
import { trackAnalyticsEvent } from "./AnalyticsConsent"

type TrackedDownloadLinkProps = ComponentProps<"a"> & {
  platform: "windows" | "debian" | "macos_arm64" | "macos_x64"
  releaseVersion: string
}

export function TrackedDownloadLink({
  children,
  onClick,
  platform,
  releaseVersion,
  ...props
}: TrackedDownloadLinkProps) {
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return

    trackAnalyticsEvent("hoprel_download_click", {
      distribution_channel: "github_release",
      platform,
      release_version: releaseVersion,
    })
  }

  return <a {...props} onClick={handleClick}>{children}</a>
}

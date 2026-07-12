const REPO_OWNER = process.env.AURICT_GITHUB_OWNER ?? 'aurict'
const REPO_NAME = process.env.AURICT_GITHUB_REPO ?? 'aurict'
const BETA_TAG_PREFIX = 'desktop-beta-v'
const INSTALLER_NAME = 'Hoprel-Beta-Setup.exe'

type GitHubRelease = {
  html_url: string
  name: string | null
  tag_name: string
  draft: boolean
  prerelease: boolean
  assets: Array<{ name: string; browser_download_url: string }>
}

export type DesktopBetaRelease = {
  releaseUrl: string
  version: string
  debian?: ReleaseAsset
  macosArm64?: ReleaseAsset
  macosX64?: ReleaseAsset
  windows?: ReleaseAsset
} | null

export type ReleaseAsset = {
  checksumUrl: string
  downloadUrl: string
}

function headers(): HeadersInit {
  const result: HeadersInit = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  }

  if (process.env.AURICT_GITHUB_TOKEN) {
    result.authorization = `Bearer ${process.env.AURICT_GITHUB_TOKEN}`
  }

  return result
}

export async function getDesktopBetaRelease(): Promise<DesktopBetaRelease> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`, {
      headers: headers(),
      next: { revalidate: 60 * 15 },
    })

    if (!response.ok) return null

    const release = (await response.json() as GitHubRelease[]).find((candidate) => (
      !candidate.draft
      && candidate.prerelease
      && candidate.tag_name.startsWith(BETA_TAG_PREFIX)
    ))
    const windows = release && releaseAsset(release, INSTALLER_NAME)
    const debian = release && releaseAsset(release, 'Hoprel-Beta-amd64.deb')
    const macosX64 = release && releaseAsset(release, 'Hoprel-Beta-macos-x64.zip')
    const macosArm64 = release && releaseAsset(release, 'Hoprel-Beta-macos-arm64.zip')

    if (!release || (!windows && !debian && !macosX64 && !macosArm64)) return null

    return {
      releaseUrl: release.html_url,
      version: release.name ?? release.tag_name.replace(BETA_TAG_PREFIX, ''),
      ...(windows ? { windows } : {}),
      ...(debian ? { debian } : {}),
      ...(macosX64 ? { macosX64 } : {}),
      ...(macosArm64 ? { macosArm64 } : {}),
    }
  } catch {
    return null
  }
}

function releaseAsset(release: GitHubRelease, name: string): ReleaseAsset | null {
  const download = release.assets.find((asset) => asset.name === name)
  const checksum = release.assets.find((asset) => asset.name === `${name}.sha256`)
  if (!download || !checksum) return null

  return {
    checksumUrl: checksum.browser_download_url,
    downloadUrl: download.browser_download_url,
  }
}

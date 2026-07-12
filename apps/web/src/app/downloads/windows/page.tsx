import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Footer } from '@/components/sections/Footer'
import { Nav } from '@/components/Nav'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getDesktopBetaRelease, type ReleaseAsset } from '@/lib/desktop-beta-release'

export const metadata: Metadata = {
  title: 'Hoprel Downloads — Desktop Beta',
  description: 'Download Hoprel by Aurict for Windows, Debian, Intel Mac, or Apple Silicon Mac and verify its SHA-256 checksum.',
  alternates: { canonical: 'https://aurict.com/downloads' },
}

export default async function WindowsDownloadPage() {
  const beta = await getDesktopBetaRelease()

  return (
    <>
      <Nav />
      <main className="marketing-main" style={{ maxWidth: 860 }}>
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Hoprel downloads', href: '/downloads' }]} />
        <section className="marketing-hero" style={{ marginTop: 24 }}>
          <p className="marketing-eyebrow">Desktop · public beta</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Image alt="Hoprel icon" height={50} src="/hoprel-icon.svg" width={50} />
            <h1 className="marketing-title">Hoprel downloads.</h1>
          </div>
          <p className="marketing-lede">
            Hoprel by Aurict is a local-first desktop workspace. Windows, Debian, and macOS packages are published from the same beta release.
          </p>
        </section>

        <section className="marketing-card" style={{ borderColor: 'color-mix(in oklch, var(--warning) 48%, var(--border))', marginBottom: 22, padding: 26 }}>
          <p className="mono" style={{ color: 'var(--warning)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>Unsigned beta notice</p>
          <p className="marketing-copy" style={{ color: 'var(--text)', marginBottom: 12 }}>
            Windows may show a SmartScreen warning and macOS may show a Gatekeeper warning because these beta builds are not publicly trusted. Only continue if you intentionally downloaded Hoprel from this page or the linked GitHub release.
          </p>
          <p className="marketing-copy">
            Do not install a root certificate or disable Windows security features. Verify the published SHA-256 checksum before opening the installer.
          </p>
        </section>

        {beta ? (
          <section className="marketing-card" style={{ padding: 28, marginBottom: 64 }}>
            <p className="mono" style={{ color: 'var(--success)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>Latest beta available</p>
            <h2 style={{ color: 'var(--text)', fontSize: 28, fontWeight: 600, marginBottom: 10 }}>{beta.version}</h2>
            <p className="marketing-copy" style={{ marginBottom: 24 }}>Every desktop package includes a SHA-256 verification file.</p>
            <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <DownloadCard
                asset={beta.windows}
                command="Get-FileHash .\Hoprel-Beta-Setup.exe -Algorithm SHA256"
                detail="Windows x64 · self-signed beta installer"
                platform="Windows"
              />
              <DownloadCard
                asset={beta.debian}
                command="sha256sum Hoprel-Beta-amd64.deb"
                detail="Debian amd64 · direct .deb package"
                platform="Debian / Ubuntu"
              />
              <DownloadCard
                asset={beta.macosArm64}
                command="shasum -a 256 Hoprel-Beta-macos-arm64.zip"
                detail="Apple Silicon · unsigned macOS ZIP"
                platform="macOS · Apple Silicon"
              />
              <DownloadCard
                asset={beta.macosX64}
                command="shasum -a 256 Hoprel-Beta-macos-x64.zip"
                detail="Intel · unsigned macOS ZIP"
                platform="macOS · Intel"
              />
            </div>
            <a className="aur-button aur-button-secondary" href={beta.releaseUrl} style={{ marginTop: 18 }}>view release</a>
          </section>
        ) : (
          <section className="marketing-card" style={{ padding: 28, marginBottom: 64 }}>
            <p className="mono" style={{ color: 'var(--warning)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>Beta build pending</p>
            <h2 style={{ color: 'var(--text)', fontSize: 28, fontWeight: 600, marginBottom: 10 }}>The first Hoprel beta is being prepared.</h2>
            <p className="marketing-copy" style={{ marginBottom: 22 }}>When published, this page will show each available desktop package and its SHA-256 checksum.</p>
            <a className="aur-button aur-button-secondary" href="https://github.com/aurict/aurict/releases">view GitHub releases</a>
          </section>
        )}

        <section className="marketing-card" style={{ padding: 26, marginBottom: 64 }}>
          <p className="marketing-eyebrow" style={{ marginBottom: 12 }}>Recommended channel</p>
          <h2 style={{ color: 'var(--text)', fontSize: 25, fontWeight: 600, marginBottom: 10 }}>Microsoft Store distribution is planned.</h2>
          <p className="marketing-copy">The Store build will provide the recommended public installation path with Microsoft-managed signing and updates.</p>
          <Link className="aur-button aur-button-secondary" href="/roadmap" style={{ marginTop: 20 }}>view product roadmap</Link>
        </section>
      </main>
      <Footer />
    </>
  )
}

function DownloadCard({
  asset,
  command,
  detail,
  platform,
}: {
  asset: ReleaseAsset | undefined
  command: string
  detail: string
  platform: string
}) {
  if (!asset) {
    return (
      <article style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
        <p className="mono" style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 10 }}>{platform}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.55 }}>Not available in this beta release.</p>
      </article>
    )
  }

  return (
    <article style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
      <p className="mono" style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>{platform}</p>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.55, marginBottom: 18 }}>{detail}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 16 }}>
        <a className="aur-button aur-button-primary" href={asset.downloadUrl}>download</a>
        <a className="aur-button aur-button-secondary" href={asset.checksumUrl}>SHA-256</a>
      </div>
      <p className="mono" style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.65 }}>{command}</p>
    </article>
  )
}

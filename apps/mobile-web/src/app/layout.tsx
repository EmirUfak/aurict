import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import Providers from "./providers";
import { Nav } from "@/components/Nav";
import "./globals.css";
import { negotiateLocale, LOCALE_COOKIE, type Locale } from "@/i18n/locales";

const BASE_URL = "https://mobile.aurict.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Aurict Mobile — mobile.aurict.com",
    template: "%s | Aurict Mobile",
  },
  description:
    "Aurict Mobile — account management, support, and legal pages for the mobile apps built with and by Aurict, including Mind Grid.",
  applicationName: "Aurict Mobile",
  authors: [{ name: "Aurict" }],
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/aurict-logo.svg", type: "image/svg+xml" }],
    shortcut: "/aurict-logo.svg",
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "Aurict Mobile",
    title: "Aurict Mobile — mobile.aurict.com",
    description:
      "Aurict Mobile — account management, support, and legal pages for the mobile apps built with and by Aurict, including Mind Grid.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aurict Mobile — mobile.aurict.com",
    description:
      "Aurict Mobile — account management, support, and legal pages for the mobile apps built with and by Aurict, including Mind Grid.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#211416",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value ?? null;
  const acceptLanguage = headerStore.get("accept-language") ?? null;
  const locale: Locale = negotiateLocale(acceptLanguage, cookieLocale);

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- next/font fetches Google Fonts during build; runtime link keeps offline builds stable. */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Source+Serif+4:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
        <Providers initialLocale={locale}>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}

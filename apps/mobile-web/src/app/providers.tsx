"use client";

import type { ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Locale } from "@/i18n/locales";

export default function Providers({
	children,
	initialLocale,
}: {
	children: ReactNode;
	initialLocale: Locale;
}) {
	return <LanguageProvider initialLocale={initialLocale}>{children}</LanguageProvider>;
}

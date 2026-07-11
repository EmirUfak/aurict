'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { messages } from '@/i18n/messages';
import { locales, defaultLocale, LOCALE_COOKIE, type Locale } from '@/i18n/locales';

interface LanguageContextValue {
	language: Locale;
	setLanguage: (locale: Locale) => void;
	t: (key: string) => string;
	locales: readonly Locale[];
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function useLanguage(): LanguageContextValue {
	const ctx = useContext(LanguageContext);
	if (!ctx) {
		throw new Error('useLanguage must be used within a LanguageProvider');
	}
	return ctx;
}

function lookup(dict: Record<string, unknown>, key: string): string | undefined {
	const parts = key.split('.');
	let node: unknown = dict;
	for (const part of parts) {
		if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
			node = (node as Record<string, unknown>)[part];
		} else {
			return undefined;
		}
	}
	return typeof node === 'string' ? node : undefined;
}

export function LanguageProvider({
	children,
	initialLocale,
}: {
	children: ReactNode;
	initialLocale: Locale;
}) {
	const [language, setLang] = useState<Locale>(initialLocale ?? defaultLocale);

	useEffect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.lang = language;
		}
	}, [language]);

	const setLanguage = useCallback((locale: Locale) => {
		setLang(locale);
		if (typeof document !== 'undefined') {
			document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
			document.documentElement.lang = locale;
		}
	}, []);

	const t = useCallback(
		(key: string): string => {
			const localized = lookup(messages[language] as Record<string, unknown>, key);
			if (localized) return localized;
			const fallback = lookup(messages[defaultLocale] as Record<string, unknown>, key);
			return fallback ?? key;
		},
		[language]
	);

	return (
		<LanguageContext.Provider value={{ language, setLanguage, t, locales }}>
			{children}
		</LanguageContext.Provider>
	);
}

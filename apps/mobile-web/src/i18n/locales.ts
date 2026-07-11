export const locales = ['en', 'tr', 'fr', 'de', 'zh'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const LOCALE_COOKIE = 'locale';

export const localeNames: Record<Locale, string> = {
	en: 'English',
	tr: 'Türkçe',
	fr: 'Français',
	de: 'Deutsch',
	zh: '中文',
};

// Native endonyms shown in the language menu
export const localeEndonyms: Record<Locale, { native: string; flag: string }> = {
	en: { native: 'English', flag: '🇬🇧' },
	tr: { native: 'Türkçe', flag: '🇹🇷' },
	fr: { native: 'Français', flag: '🇫🇷' },
	de: { native: 'Deutsch', flag: '🇩🇪' },
	zh: { native: '中文', flag: '🇨🇳' },
};

export function isLocale(value: string | undefined | null): value is Locale {
	return !!value && (locales as readonly string[]).includes(value);
}

// Resolves the active locale from a cookie (user override) and the
// Accept-Language header (browser default). Cookie wins when present.
export function negotiateLocale(
	acceptLanguage: string | null,
	cookieLocale: string | null
): Locale {
	if (isLocale(cookieLocale)) return cookieLocale;
	if (acceptLanguage) {
		const wanted = acceptLanguage
			.split(',')
			.map((part) => part.split(';')[0].trim().split('-')[0].toLowerCase());
		for (const w of wanted) {
			if ((locales as readonly string[]).includes(w)) return w as Locale;
		}
	}
	return defaultLocale;
}

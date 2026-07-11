import { NextRequest, NextResponse } from 'next/server';
import { negotiateLocale, LOCALE_COOKIE } from '@/i18n/locales';

export function middleware(req: NextRequest) {
	const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value ?? null;
	const acceptLanguage = req.headers.get('accept-language');
	const locale = negotiateLocale(acceptLanguage, cookieLocale);

	const res = NextResponse.next();
	if (req.cookies.get(LOCALE_COOKIE)?.value !== locale) {
		res.cookies.set(LOCALE_COOKIE, locale, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax',
		});
	}
	return res;
}

export const config = {
	matcher: [
		'/((?!_next/|api/|sitemap.xml|robots.txt|favicon.ico|aurict-logo.svg|mindgrid-logo.png|.*\\.).*)',
	],
};

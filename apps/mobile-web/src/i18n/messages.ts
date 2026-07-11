import type { Locale } from './locales';
import { en } from './dicts/en';
import { tr } from './dicts/tr';
import { fr } from './dicts/fr';
import { de } from './dicts/de';
import { zh } from './dicts/zh';

export type Messages = typeof en;

export const messages: Record<Locale, Messages> = {
	en,
	tr,
	fr,
	de,
	zh,
};

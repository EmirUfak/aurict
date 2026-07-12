import type { ColorMode, UserProfile } from '../../shared/ipc-types.js';

export function resolveColorMode(colorMode: ColorMode, prefersDark: boolean): Exclude<ColorMode, 'system'> {
  return colorMode === 'system' ? prefersDark ? 'dark' : 'light' : colorMode;
}

export function applyAppearance(target: HTMLElement, profile: Pick<UserProfile, 'theme' | 'fontPair' | 'colorMode'>, prefersDark: boolean): void {
  target.dataset.theme = profile.theme;
  target.dataset.fontPair = profile.fontPair;
  target.dataset.colorMode = resolveColorMode(profile.colorMode, prefersDark);
}

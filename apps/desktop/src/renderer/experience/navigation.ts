import type { UserType } from '../../shared/ipc-types.js';

export type Screen = 'main' | 'extensions' | 'design' | 'finance' | 'memory' | 'settings';
export type NavigationItem = { id: Screen; label: string };

const MAIN_LABEL: Record<UserType, string> = { general: 'home', developer: 'workspace', product: 'product', designer: 'home', operator: 'operations', finance: 'home' };

export function navigationFor(userType: UserType): NavigationItem[] {
  return [{ id: 'main', label: MAIN_LABEL[userType] }, { id: 'design', label: 'design' }, { id: 'finance', label: 'finance' }, { id: 'extensions', label: 'extensions' }, { id: 'memory', label: 'memory' }, { id: 'settings', label: 'settings' }];
}

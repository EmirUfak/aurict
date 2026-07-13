import type { Screen } from './experience/navigation.js';

export type ShortcutAction = 'newSession' | 'openSettings' | 'openHome' | 'openDesign' | 'openFinance';
export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = { newSession: 'Ctrl+N', openSettings: 'Ctrl+,', openHome: 'Ctrl+1', openDesign: 'Ctrl+2', openFinance: 'Ctrl+3' };
const storageKey = 'hoprel.shortcuts.v1';
export function readShortcuts(): Record<ShortcutAction, string> { try { return { ...DEFAULT_SHORTCUTS, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') }; } catch { return DEFAULT_SHORTCUTS; } }
export function saveShortcuts(value: Record<ShortcutAction, string>) { localStorage.setItem(storageKey, JSON.stringify(value)); }
export function eventShortcut(event: KeyboardEvent) { const key = event.key.length === 1 ? event.key.toUpperCase() : event.key; return `${event.ctrlKey || event.metaKey ? 'Ctrl+' : ''}${event.altKey ? 'Alt+' : ''}${event.shiftKey ? 'Shift+' : ''}${key}`; }
export function screenForShortcut(action: ShortcutAction): Screen | null { return action === 'openSettings' ? 'settings' : action === 'openHome' ? 'main' : action === 'openDesign' ? 'design' : action === 'openFinance' ? 'finance' : null; }

export type ComposerQueueKind = "steer" | "queued";

export interface ComposerQueueItem {
  id: string;
  kind: ComposerQueueKind;
  text: string;
}

export function addComposerItem(items: ComposerQueueItem[], item: ComposerQueueItem): ComposerQueueItem[] {
  if (item.kind === "queued") return [...items, item];
  const firstQueued = items.findIndex((candidate) => candidate.kind === "queued");
  if (firstQueued === -1) return [...items, item];
  return [...items.slice(0, firstQueued), item, ...items.slice(firstQueued)];
}

export function takeComposerItem(items: ComposerQueueItem[]): { item?: ComposerQueueItem; remaining: ComposerQueueItem[] } {
  const [item, ...remaining] = items;
  return { ...(item ? { item } : {}), remaining };
}

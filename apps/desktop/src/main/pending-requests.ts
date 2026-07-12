export interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export type PendingQueue<T> = PendingRequest<T>[];

export function requestFromSidecar<T>(
  queue: PendingQueue<T>,
  label: string,
  send: () => void,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const pending: PendingRequest<T> = {
      resolve,
      reject,
      timeout: setTimeout(() => {
        const index = queue.indexOf(pending);
        if (index >= 0) queue.splice(index, 1);
        reject(new Error(`${label} did not respond within ${Math.ceil(timeoutMs / 1_000)} seconds.`));
      }, timeoutMs),
    };
    queue.push(pending);
    try {
      send();
    } catch (error) {
      clearTimeout(pending.timeout);
      queue.splice(queue.indexOf(pending), 1);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function resolveNext<T>(queue: PendingQueue<T>, value: T): void {
  const pending = queue.shift();
  if (!pending) return;
  clearTimeout(pending.timeout);
  pending.resolve(value);
}

export function rejectQueue<T>(queue: PendingQueue<T>, error: Error): void {
  for (const pending of queue.splice(0)) {
    clearTimeout(pending.timeout);
    pending.reject(error);
  }
}

import { useEffect, useRef } from 'react';

// Fires `onGiveUp` at the two moments that matter for a stale screen:
//  1. the sidecar gives up after its 1s/2s/4s auto-reconnect attempts
//     (SidecarStatus.giveUp) — surfaces the real failure immediately
//     instead of staying silent until the user clicks something or
//     switches screens;
//  2. it reconnects afterward (Titlebar retry, or a fresh auto-restart) —
//     the same call re-fetches (this time it can succeed), which clears
//     the error and, via useErrorToast's dismissToast wiring, closes the
//     toast raised in step 1 on its own.
// Transient blips during the 1s/2s/4s auto-reconnect window itself are
// ignored on purpose — a request that recovers within a few seconds
// shouldn't alarm anyone.
export function useSidecarGiveUp(onGiveUp: () => void) {
  const wasGivenUp = useRef(false);

  useEffect(() => {
    return window.aurict.runtime.onStatus((status) => {
      if (status.giveUp && !wasGivenUp.current) {
        wasGivenUp.current = true;
        onGiveUp();
      } else if (status.connected && wasGivenUp.current) {
        wasGivenUp.current = false;
        onGiveUp();
      }
    });
  }, [onGiveUp]);
}

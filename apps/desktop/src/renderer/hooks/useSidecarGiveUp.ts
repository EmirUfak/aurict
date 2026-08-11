import { useEffect, useRef } from 'react';

// Fires `onGiveUp`:
//  1. immediately when the sidecar gives up after its 1s/2s/4s
//     auto-reconnect attempts (SidecarStatus.giveUp) — surfaces the real
//     failure instead of staying silent until the user clicks something or
//     switches screens;
//  2. once, the first time the sidecar reports connected again after ANY
//     disconnected stretch — not only a confirmed giveUp. A cold app start
//     (bun run start) can have a hook's very first request time out via
//     requestFromSidecar's own 15s timeout while the sidecar is still
//     "starting", without ever reaching giveUp:true — if we only re-fired
//     after a confirmed giveUp, that toast would never self-clear once the
//     sidecar actually came up, since wasDisconnected alone (not giveUp)
//     is what a plain slow-start failure leaves behind.
// Transient blips during the 1s/2s/4s auto-reconnect window itself don't
// trigger onGiveUp on their own — only an explicit giveUp does — so a
// request that recovers within a few seconds doesn't alarm anyone; but any
// of those "disconnected" states still arms the reconnect re-fetch below.
export function useSidecarGiveUp(onGiveUp: () => void) {
  const wasDisconnected = useRef(false);

  useEffect(() => {
    return window.aurict.runtime.onStatus((status) => {
      if (!status.connected) {
        wasDisconnected.current = true;
        if (status.giveUp) onGiveUp();
      } else if (wasDisconnected.current) {
        wasDisconnected.current = false;
        onGiveUp();
      }
    });
  }, [onGiveUp]);
}

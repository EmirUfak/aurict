import { useEffect, useRef } from 'react';

// Runs `onGiveUp` once each time the sidecar transitions into its "stopped
// auto-retrying, waiting on a manual click" state (SidecarStatus.giveUp).
// Deliberately ignores the brief 1s/2s/4s auto-reconnect window in between —
// a request that recovers on its own within a few seconds shouldn't alarm
// the user. onGiveUp is meant to be a hook's own refresh()/list() call: it
// will fail immediately (the sidecar is confirmed down), which populates
// that hook's existing error/errorSeq state and fires its already-wired
// toast — no new UI, just triggering the existing one without waiting for
// the user to click something or switch screens.
export function useSidecarGiveUp(onGiveUp: () => void) {
  const hasFiredForThisOutage = useRef(false);

  useEffect(() => {
    return window.aurict.runtime.onStatus((status) => {
      if (status.giveUp && !hasFiredForThisOutage.current) {
        hasFiredForThisOutage.current = true;
        onGiveUp();
      } else if (status.connected) {
        hasFiredForThisOutage.current = false;
      }
    });
  }, [onGiveUp]);
}

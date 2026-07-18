import React from "react";

/** Stable modal boundary; overlay contents remain mounted above the transcript. */
export function OverlayStack({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

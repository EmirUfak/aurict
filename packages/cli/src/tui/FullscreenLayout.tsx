import React, { useRef, useLayoutEffect } from "react"
import { Box, measureElement } from "ink"
import type { DOMElement } from "ink"

interface FullscreenLayoutProps {
  rows:                number
  header?:             React.ReactNode  // fixed top (banner, update notice, session title)
  scrollable:          React.ReactNode  // grows to fill space (ConversationViewport)
  overlay?:            React.ReactNode  // modals rendered between scrollable and bottom
  bottom:              React.ReactNode  // fixed bottom (input area + status bar)
  onScrollableHeight?: (rows: number) => void  // fires when scrollable slot height changes
}

export function FullscreenLayout({
  rows,
  header,
  scrollable,
  overlay,
  bottom,
  onScrollableHeight,
}: FullscreenLayoutProps) {
  const scrollableRef  = useRef<DOMElement>(null)
  const lastHeightRef  = useRef<number>(-1)

  useLayoutEffect(() => {
    if (!scrollableRef.current || !onScrollableHeight) return
    const { height } = measureElement(scrollableRef.current)
    // Hysteresis: only notify on a ≥2-row change. Prevents 1-row oscillations
    // during header/bottom transitions (banner→chat, permission prompt) from
    // triggering the measure→setState→re-render loop and corrupting the frame.
    if (height > 0 && Math.abs(height - lastHeightRef.current) >= 2) {
      lastHeightRef.current = height
      onScrollableHeight(height)
    }
  })

  return (
    <Box flexDirection="column" height={rows} overflow="hidden" flexGrow={1} flexShrink={1}>
      {header && (
        <Box flexDirection="column" flexShrink={0}>
          {header}
        </Box>
      )}
      <Box ref={scrollableRef} flexGrow={1} flexShrink={1} flexDirection="column" overflow="hidden">
        {scrollable}
      </Box>
      {/* The overlay (picker/modal) is the focused UI — it must NEVER shrink.
          With flexShrink={1}, Yoga would shrink this box when space got
          tight and Ink would draw with skipped rows (the title + selected
          row would become invisible). Shrinking is delegated to the
          scrollable area instead; overlay components cap their own height
          based on the terminal's row count. */}
      {overlay && (
        <Box flexDirection="column" flexShrink={0}>
          {overlay}
        </Box>
      )}
      <Box flexDirection="column" flexShrink={0} overflow="hidden">
        {bottom}
      </Box>
    </Box>
  )
}

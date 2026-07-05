import React, { useEffect, useState } from "react"

function readNoMotion(): boolean {
  return (
    process.env["AURICT_NO_MOTION"] === "1" ||
    process.env["AURICT_NO_MOTION"] === "true" ||
    process.env["NO_COLOR"] === "1" ||
    process.env["TERM"] === "dumb"
  )
}

export function motionEnabled(): boolean {
  return !readNoMotion()
}

export const BLINK_INTERVAL_MS = 1100
export const PULSE_INTERVAL_MS = 1800

export function useBlinkFrame(): boolean {
  const [on, setOn] = useState(true)
  useEffect(() => {
    if (!motionEnabled()) {
      setOn(true)
      return
    }
    const t = setInterval(() => setOn((v) => !v), BLINK_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])
  return on
}

export function usePulseFrame(): number {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!motionEnabled()) {
      setFrame(0)
      return
    }
    const t = setInterval(() => setFrame((n) => (n + 1) % Number.MAX_SAFE_INTEGER), PULSE_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])
  return frame
}

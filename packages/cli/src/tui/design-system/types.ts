/**
 * Design System — Common types and Box wrapper
 *
 * Ink 5.2.1 notes:
 * - `BoxProps` (the type Ink exports) is actually NOT Box's parameter type,
 *   it's just derived from `Styles`. That's why it doesn't include `children`.
 * - `backgroundColor` works at render time but isn't in the type signature.
 *
 * `DesignBoxProps` and `DesignBox` fill these two gaps.
 */

import React from "react"
import { Box as InkBox, type BoxProps } from "ink"

export type DesignBoxProps = BoxProps & {
  /** Background color — Ink translates this to an ANSI bg escape at render time */
  readonly backgroundColor?: string
  /** React children (not in Ink's BoxProps) */
  children?: React.ReactNode
}

/**
 * A type-safe Box alias. Accepts `backgroundColor` and `children` props.
 *
 * Usage: `import { DesignBox as Box } from "./types.js"`
 */
export const DesignBox = InkBox as React.ComponentType<DesignBoxProps>

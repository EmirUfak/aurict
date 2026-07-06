import type { DOMElement } from "ink"

/**
 * Computes a `<Box>` node's absolute top-left coordinate relative to the
 * ROOT of the render tree (row, col — 0-based).
 *
 * Ink's official `measureElement()` API only returns width/height, not
 * position. This function walks the same `node.yogaNode`/`node.parentNode`
 * fields that `measureElement()` itself uses internally (officially exported
 * via ink's `DOMElement` type) up to the root, summing each level's
 * `getComputedTop()`/`getComputedLeft()` to derive the absolute position.
 *
 * Since Aurict uses the alternate screen buffer and the root `<Box>` is
 * always rendered at the FULL terminal height via `height={termRows}`, the
 * root's top-left corner maps to the terminal's (1,1) cell — so the (row,
 * col) returned here can be mapped directly to `mouse.ts`'s 1-based
 * `MouseEvent.x/y` with a `+1` offset.
 */
export function measureAbsolutePosition(node: DOMElement): { row: number; col: number } {
  let row = 0
  let col = 0
  let current: DOMElement | undefined = node
  while (current) {
    row += current.yogaNode?.getComputedTop() ?? 0
    col += current.yogaNode?.getComputedLeft() ?? 0
    current = current.parentNode
  }
  return { row, col }
}

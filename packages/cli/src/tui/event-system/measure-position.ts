import type { DOMElement } from "ink"

/**
 * Bir `<Box>` node'unun render ağacındaki KÖKE göre mutlak sol-üst
 * koordinatını hesaplar (satır, sütun — 0-based).
 *
 * Ink'in resmi `measureElement()` API'si yalnızca genişlik/yükseklik döner,
 * konum vermez. Bu fonksiyon, `measureElement`'in kendisinin de içeride
 * kullandığı aynı `node.yogaNode`/`node.parentNode` alanlarını (ink'in
 * `DOMElement` tipinden resmi olarak export edilir) kök'e kadar yürüyüp
 * her seviyenin `getComputedTop()`/`getComputedLeft()` değerini toplayarak
 * mutlak konumu çıkarır.
 *
 * Aurict alternate screen buffer kullandığı ve kök `<Box>` her zaman
 * `height={termRows}` ile TAM terminal yüksekliğinde render edildiği için,
 * kökün sol-üst köşesi terminalin (1,1) hücresine denk gelir — yani buradan
 * dönen (row, col) doğrudan `mouse.ts`'in 1-based `MouseEvent.x/y`'sine
 * `+1` ile eşlenebilir.
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

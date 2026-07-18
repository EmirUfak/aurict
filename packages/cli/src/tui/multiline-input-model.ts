export interface LocalPoint { row: number; col: number }

export function extractRange(lines: string[], a: LocalPoint, b: LocalPoint): string {
  const [start, end] = a.row < b.row || (a.row === b.row && a.col <= b.col) ? [a, b] : [b, a]
  if (start.row === end.row) {
    const line = lines[start.row] ?? ""
    return line.slice(Math.min(start.col, end.col), Math.max(start.col, end.col))
  }
  const parts = [(lines[start.row] ?? "").slice(start.col)]
  for (let row = start.row + 1; row < end.row; row++) parts.push(lines[row] ?? "")
  parts.push((lines[end.row] ?? "").slice(0, end.col))
  return parts.join("\n")
}

export function splitLines(value: string): string[] {
  const lines = value.split("\n")
  return lines.length > 0 ? lines : [""]
}

export function wordLeft(line: string, column: number): number {
  let index = column
  while (index > 0 && /\s/.test(line[index - 1]!)) index--
  while (index > 0 && /\S/.test(line[index - 1]!)) index--
  return index
}

export function wordRight(line: string, column: number): number {
  let index = column
  while (index < line.length && /\S/.test(line[index]!)) index++
  while (index < line.length && /\s/.test(line[index]!)) index++
  return index
}

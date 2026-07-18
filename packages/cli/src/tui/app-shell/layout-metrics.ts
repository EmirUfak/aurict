export function shellHorizontalInset(columns: number): number {
  if (columns < 60) return 0;
  if (columns < 100) return 1;
  return 2;
}

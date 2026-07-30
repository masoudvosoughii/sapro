/**
 * Format tabular string data with tab separators and line dividers.
 * Matches Python ``format_table`` behavior.
 */
export function formatTable(
  data: readonly (readonly string[])[],
  shape: readonly [number, number],
  separator = '-',
): string {
  const [height, width] = shape;
  const columnWidths: number[] = [];

  for (let col = 0; col < width; col += 1) {
    let maxWidth = 0;
    for (let row = 0; row < height; row += 1) {
      const cell = data[row]?.[col] ?? '';
      if (cell.length > maxWidth) {
        maxWidth = cell.length;
      }
    }
    columnWidths.push(Math.floor(maxWidth / 8) + 1);
  }

  const lines: string[] = [];
  for (const row of data) {
    const cells: string[] = [];
    for (let col = 0; col < width; col += 1) {
      const value = row[col] ?? '';
      const tabsNeeded = Math.ceil((columnWidths[col] ?? 1) - value.length / 8);
      cells.push(`${value}${'\t'.repeat(Math.max(tabsNeeded, 1))}`);
    }
    lines.push(cells.join(''));
    lines.push(separator.repeat(8 * columnWidths.reduce((sum, widthValue) => sum + widthValue, 0)));
  }
  return `${lines.join('\n')}\n`;
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}

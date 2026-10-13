/** Quotes a CSV cell and neutralises spreadsheet formula injection. Exported
 *  values come from visitor input, and a leading =, +, -, @, tab or CR makes
 *  Excel/Sheets evaluate the cell, so those get a leading quote. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

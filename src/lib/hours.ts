// Opening hours are free-text settings ("10:00", "6:00", "6 PM"), so normalise
// them to 24-hour "HH:MM" at display time rather than trusting the stored form.

function parse(time: string): { h: number; m: number; meridiem: 'am' | 'pm' | null } | null {
  const match = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i);
  if (!match) return null;
  const meridiem = match[3] ? (match[3].toLowerCase() === 'p' ? 'pm' : 'am') : null;
  return { h: Number(match[1]), m: Number(match[2] ?? 0), meridiem };
}

function to24(h: number, meridiem: 'am' | 'pm' | null): number {
  if (meridiem === 'pm') return h % 12 + 12;
  if (meridiem === 'am') return h % 12;
  return h;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Formats an opening/closing pair as 24-hour times. A closing time with no
 * AM/PM that falls at or before the opening hour ("10:00"–"6:00") is read as
 * PM, since a business day doesn't end before it starts.
 */
export function hours24(opens: string, closes: string): { opens: string; closes: string } {
  const o = parse(opens);
  const c = parse(closes);
  if (!o || !c) return { opens, closes };
  const oh = to24(o.h, o.meridiem);
  let ch = to24(c.h, c.meridiem);
  if (!c.meridiem && ch < 12 && ch <= oh) ch += 12;
  return { opens: `${pad(oh)}:${pad(o.m)}`, closes: `${pad(ch)}:${pad(c.m)}` };
}

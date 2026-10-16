// The calendar file (.ics) read for a span of days (2.1.0): Today used to read
// today only; the week view and « Upcoming » need the days ahead. Hours are
// local; a time written in UTC (…Z) is moved to this computer's time zone.
// Events without an hour (all day) and repeating rules are not read.

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** « 20261016T093000 » or « 20261016T093000Z » → { date: 'YYYY-MM-DD', hour: 9.5 }, or null. */
export function readStamp(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(String(s || '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (z) {
    const at = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    return { date: isoDay(at), hour: at.getHours() + at.getMinutes() / 60 };
  }
  return { date: `${y}-${mo}-${d}`, hour: +h + +mi / 60 };
}

/** The events from `from` to `to` (YYYY-MM-DD, both included): [{ date, label, start, end }] in hours. */
export function eventsBetween(icsText, from, to) {
  const events = [];
  for (const block of String(icsText || '').split('BEGIN:VEVENT').slice(1)) {
    const summary = (block.match(/^SUMMARY:(.+)$/m) || [])[1]?.trim();
    const start = readStamp((block.match(/^DTSTART[^:]*:(.+)$/m) || [])[1]);
    if (!summary || !start || start.date < from || start.date > to) continue;
    const end = readStamp((block.match(/^DTEND[^:]*:(.+)$/m) || [])[1]);
    // Past midnight: stops at the end of its first day.
    const endHour = !end ? start.hour + 1 : end.date === start.date ? end.hour : 24;
    if (endHour <= start.hour) continue;
    events.push({ type: 'meeting', date: start.date, label: summary, start: start.hour, end: endHour });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

export { isoDay };

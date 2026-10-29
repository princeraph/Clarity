// The calendar file (.ics) read for a span of days (2.1.0): Today used to read
// today only; the week view and « Upcoming » need the days ahead. Hours are
// local; a time written in UTC (…Z) is moved to this computer's time zone, a
// time with a TZID is taken as written (the calendar's zone is assumed to be
// this computer's). Events without an hour (all day) are not read.
//
// Measured on a Google Calendar export (tâche 5, 29 October): long titles are
// folded over two lines, commas come escaped (« \, »), a weekly meeting is ONE
// event with a repeat rule, a moved or cancelled occurrence is a second event
// with the same UID, a cancelled event stays in the file, and a weekend away
// spans three days. The first reader got every one of those wrong: a weekly
// meeting never showed after its first week. Hence the rules below.

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

// Days as whole numbers, in UTC so a change of time never shifts them.
const dayNum = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const dayIso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MAX_DAYS = 366 * 20;   // a rule is never followed further than this

const unescape = (v) => v.replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? ' ' : c)).trim();

/** One VEVENT's lines → { NAME: [{ params, value }] }, alarms left out. */
function readProps(block) {
  const props = {};
  let depth = 0;
  for (const line of block.split(/\r?\n/)) {
    if (/^BEGIN:/.test(line)) { depth++; continue; }
    if (/^END:/.test(line)) { depth--; continue; }
    if (depth > 0) continue;
    const m = /^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
    if (!m) continue;
    (props[m[1].toUpperCase()] ||= []).push({ params: m[2], value: m[3] });
  }
  return props;
}

/** « FREQ=WEEKLY;BYDAY=MO,WE » → a test « does this rule fall on day n? » plus its limits. */
function readRule(text, first) {
  const r = Object.fromEntries(String(text).split(';').map(p => p.split('=')).map(([k, v]) => [k.toUpperCase(), v]));
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(r.FREQ)) return null;
  const every = Math.max(1, parseInt(r.INTERVAL, 10) || 1);
  const f = new Date(first * 86400000);
  const byDay = r.BYDAY ? r.BYDAY.split(',').map(s => /^([+-]?\d+)?([A-Z]{2})$/.exec(s)).filter(Boolean)
    .map(([, n, d]) => ({ n: n ? +n : 0, wd: WEEKDAYS.indexOf(d) })) : null;
  const byMonthDay = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
  const byMonth = r.BYMONTH ? r.BYMONTH.split(',').map(Number) : null;
  const falls = (n) => {
    const d = new Date(n * 86400000);
    const wd = d.getUTCDay(), md = d.getUTCDate(), mo = d.getUTCMonth(), y = d.getUTCFullYear();
    const months = (y - f.getUTCFullYear()) * 12 + mo - f.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    if (byMonth && !byMonth.includes(mo + 1)) return false;
    switch (r.FREQ) {
      case 'DAILY': return (n - first) % every === 0 && (!byDay || byDay.some(b => b.wd === wd));
      case 'WEEKLY': {
        // Weeks start on Monday (WKST=MO, Google's and the standard's default).
        const week = (x) => Math.floor((x - ((new Date(x * 86400000).getUTCDay() + 6) % 7)) / 7);
        if ((week(n) - week(first)) % every !== 0) return false;
        return byDay ? byDay.some(b => b.wd === wd) : wd === f.getUTCDay();
      }
      case 'MONTHLY':
        if (months % every !== 0) return false;
        if (byMonthDay) return byMonthDay.some(k => (k > 0 ? k : daysInMonth + k + 1) === md);
        // « 2TU »: the second Tuesday; « -1FR »: the last Friday.
        if (byDay) return byDay.some(b => b.wd === wd && (b.n === 0 || (b.n > 0 ? Math.ceil(md / 7) === b.n : -Math.ceil((daysInMonth - md + 1) / 7) === b.n)));
        return md === f.getUTCDate();
      case 'YEARLY':
        if ((y - f.getUTCFullYear()) % every !== 0) return false;
        return md === f.getUTCDate() && (byMonth ? true : mo === f.getUTCMonth());
    }
    return false;
  };
  const until = r.UNTIL ? (readStamp(r.UNTIL) || (/^\d{8}$/.test(r.UNTIL) ? { date: `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}`, hour: 24 } : null)) : null;
  return { falls, count: parseInt(r.COUNT, 10) || 0, until };
}

/** The events from `from` to `to` (YYYY-MM-DD, both included): [{ date, label, start, end }] in hours. */
export function eventsBetween(icsText, from, to) {
  const text = String(icsText || '').replace(/\r?\n[ \t]/g, '');   // unfold long lines
  const vevents = text.split('BEGIN:VEVENT').slice(1).map(b => readProps(b.split(/^END:VEVENT/m)[0]));
  // An occurrence moved or cancelled on its own is a second event carrying the
  // series' UID and the original start: the series must skip that day.
  const replaced = new Set(vevents.filter(p => p['RECURRENCE-ID'])
    .map(p => `${p.UID?.[0].value}|${readStamp(p['RECURRENCE-ID'][0].value)?.date}`));

  const lo = dayNum(from), hi = dayNum(to);
  const events = [];
  for (const p of vevents) {
    if (/^CANCELLED$/i.test(p.STATUS?.[0].value || '')) continue;
    const label = p.SUMMARY ? unescape(p.SUMMARY[0].value) : '';
    const start = readStamp(p.DTSTART?.[0].value);
    if (!label || !start) continue;
    const end = readStamp(p.DTEND?.[0].value);
    // No end: one hour. The length is kept in days and hours so a series
    // keeps it on every occurrence.
    const spanDays = end ? dayNum(end.date) - dayNum(start.date) : 0;
    const endHour = end ? end.hour : start.hour + 1;
    if (spanDays < 0 || (spanDays === 0 && endHour <= start.hour)) continue;

    const first = dayNum(start.date);
    let starts = [first];
    const rule = !p['RECURRENCE-ID'] && p.RRULE ? readRule(p.RRULE[0].value, first) : null;
    if (rule) {
      const skip = new Set((p.EXDATE || []).flatMap(x => x.value.split(',')).map(v => readStamp(v)?.date || (/^\d{8}$/.test(v.trim()) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null)));
      const uid = p.UID?.[0].value;
      starts = [];
      let seen = 0;
      for (let n = first; n <= Math.min(hi, first + MAX_DAYS); n++) {
        if (!rule.falls(n)) continue;
        const iso = dayIso(n);
        if (rule.until && (iso > rule.until.date || (iso === rule.until.date && start.hour > rule.until.hour))) break;
        seen++;
        if (rule.count && seen > rule.count) break;
        if (n + spanDays < lo || skip.has(iso) || replaced.has(`${uid}|${iso}`)) continue;
        starts.push(n);
      }
    }
    // Over several days, each day shows its part: to midnight, the whole
    // day, from midnight.
    for (const s of starts) {
      for (let n = Math.max(s, lo); n <= Math.min(s + spanDays, hi); n++) {
        const a = n === s ? start.hour : 0;
        const b = n === s + spanDays ? endHour : 24;
        if (b > a) events.push({ type: 'meeting', date: dayIso(n), label, start: a, end: Math.min(b, 24) });
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

export { isoDay };

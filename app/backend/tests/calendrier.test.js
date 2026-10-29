import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { readStamp, eventsBetween } from '../src/calendrier.js';

const ics = (...events) => `BEGIN:VCALENDAR\n${events.map(([s, a, b]) => `BEGIN:VEVENT\nSUMMARY:${s}\nDTSTART:${a}\n${b ? `DTEND:${b}\n` : ''}END:VEVENT`).join('\n')}\nEND:VCALENDAR`;

describe('the calendar, over several days', () => {
  test('a local time', () => { expect(readStamp('20261016T093000')).toEqual({ date: '2026-10-16', hour: 9.5 }); });
  test('a UTC time moves to the local zone', () => {
    const at = new Date(Date.UTC(2026, 9, 16, 13, 0));
    expect(readStamp('20261016T130000Z')).toEqual({ date: `2026-10-${String(at.getDate()).padStart(2, '0')}`, hour: at.getHours() });
  });
  test('an all-day event has no hour', () => { expect(readStamp('20261016')).toBeNull(); });
  test('only the days asked, in order', () => {
    const text = ics(['Dentiste', '20261020T140000', '20261020T150000'], ['Avant', '20261015T090000', '20261015T100000'],
      ['Réunion', '20261017T090000', '20261017T103000'], ['Après', '20261030T090000', '20261030T100000']);
    expect(eventsBetween(text, '2026-10-16', '2026-10-22').map(e => [e.date, e.label, e.start, e.end]))
      .toEqual([['2026-10-17', 'Réunion', 9, 10.5], ['2026-10-20', 'Dentiste', 14, 15]]);
  });
  test('no end: one hour; past midnight: each day its part', () => {
    const text = ics(['Sans fin', '20261016T090000'], ['Soirée', '20261016T220000', '20261017T020000']);
    expect(eventsBetween(text, '2026-10-16', '2026-10-17').map(e => [e.date, e.start, e.end]))
      .toEqual([['2026-10-16', 9, 10], ['2026-10-16', 22, 24], ['2026-10-17', 0, 2]]);
  });
  test('nothing to read: nothing', () => { expect(eventsBetween('', '2026-10-16', '2026-10-22')).toEqual([]); });
});

// A real Google Calendar export (CRLF, folded lines, escapes, a time zone, an
// alarm inside the event, repeat rules, a moved and a cancelled occurrence).
describe('a Google Calendar export', () => {
  const text = readFileSync(new URL('./fixtures/google-export.ics', import.meta.url), 'utf8');
  const week = (a, b) => eventsBetween(text, a, b).map(e => `${e.date} ${e.start}-${e.end} ${e.label}`);

  test('the week of 2 November, as the calendar shows it', () => {
    expect(week('2026-11-02', '2026-11-08')).toEqual([
      "2026-11-03 14-15 Rendez-vous chez la dentiste, Dre Tremblay — apporter la carte d'assurance maladie",
      '2026-11-03 17-18 Loyer',
      "2026-11-04 9.5-11 Point d'équipe (long)",
      '2026-11-06 20-24 Fin de semaine au chalet',
      '2026-11-07 0-24 Fin de semaine au chalet',
      '2026-11-08 0-12 Fin de semaine au chalet',
    ]);
  });
  test('a weekly meeting comes back every week', () => {
    expect(week('2026-11-09', '2026-11-15')).toEqual(["2026-11-09 9.5-10 Point d'équipe", "2026-11-11 9.5-10 Point d'équipe"]);
  });
  test('a series ends at its COUNT and at its UNTIL', () => {
    const oct = week('2026-10-01', '2026-10-31');
    expect(oct.filter(l => l.endsWith('Série finie')).map(l => l.slice(0, 10))).toEqual(['2026-10-01', '2026-10-03', '2026-10-05']);
    expect(oct.filter(l => l.endsWith('Dîner du vendredi')).map(l => l.slice(0, 10))).toEqual(['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23']);
  });
  test('a long event already begun is shown from the first day asked', () => {
    expect(week('2026-11-07', '2026-11-07')).toEqual(['2026-11-07 0-24 Fin de semaine au chalet']);
  });
});

describe('repeat rules', () => {
  const rule = (r, a, b) => eventsBetween(`BEGIN:VEVENT\nSUMMARY:X\nDTSTART:20260101T090000\nDTEND:20260101T100000\nRRULE:${r}\nEND:VEVENT`, a, b).map(e => e.date);
  test('every other week on Tuesday and Thursday', () => {
    expect(rule('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH', '2026-01-01', '2026-01-25')).toEqual(['2026-01-01', '2026-01-13', '2026-01-15']);
  });
  test('the second Tuesday, the last Friday, of each month', () => {
    expect(rule('FREQ=MONTHLY;BYDAY=2TU', '2026-02-01', '2026-03-31')).toEqual(['2026-02-10', '2026-03-10']);
    expect(rule('FREQ=MONTHLY;BYDAY=-1FR', '2026-02-01', '2026-03-31')).toEqual(['2026-02-27', '2026-03-27']);
  });
  test('the last day of the month; every year', () => {
    expect(rule('FREQ=MONTHLY;BYMONTHDAY=-1', '2026-02-01', '2026-03-31')).toEqual(['2026-02-28', '2026-03-31']);
    expect(rule('FREQ=YEARLY', '2026-06-01', '2028-01-31')).toEqual(['2027-01-01', '2028-01-01']);
  });
  test('a rule it does not know: the first occurrence only', () => {
    expect(rule('FREQ=HOURLY', '2026-01-01', '2026-01-03')).toEqual(['2026-01-01']);
  });
});

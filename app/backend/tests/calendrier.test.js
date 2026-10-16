import { describe, test, expect } from '@jest/globals';
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
  test('no end: one hour; past midnight: stops at midnight', () => {
    const text = ics(['Sans fin', '20261016T090000'], ['Soirée', '20261016T220000', '20261017T020000']);
    expect(eventsBetween(text, '2026-10-16', '2026-10-16').map(e => [e.start, e.end])).toEqual([[9, 10], [22, 24]]);
  });
  test('nothing to read: nothing', () => { expect(eventsBetween('', '2026-10-16', '2026-10-22')).toEqual([]); });
});

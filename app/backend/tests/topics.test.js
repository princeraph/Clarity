import { describe, test, expect } from '@jest/globals';
import { topicKey, spellings, canonicalTags, renameTopic, removeTopic } from '../src/topics.js';

const tasks = () => [
  { id: 'a', tags: ['Perso'] },
  { id: 'b', tags: ['Perso', 'travail'] },
  { id: 'c', tags: ['perso '] },
  { id: 'd', tags: [] },
];

describe('topics — one topic whatever the case', () => {
  test('a key ignores case and surrounding spaces', () => {
    expect(topicKey(' Perso ')).toBe(topicKey('perso'));
  });

  test('the spelling in use is the most frequent one', () => {
    expect(spellings(tasks()).get('perso')).toBe('Perso');
    expect(spellings(tasks()).get('travail')).toBe('travail');
  });

  test('a new tag takes the spelling already in use', () => {
    expect(canonicalTags(['perso'], spellings(tasks()))).toEqual(['Perso']);
  });

  test('two spellings on one task become one tag, empty tags go', () => {
    expect(canonicalTags(['Perso', ' perso', '  ', 'Courses'])).toEqual(['Perso', 'Courses']);
  });

  test('an unknown tag keeps its own spelling, trimmed', () => {
    expect(canonicalTags(['  Lecture '], spellings(tasks()))).toEqual(['Lecture']);
  });
});

describe('topics — rename, merge, remove', () => {
  test('renaming reaches every spelling of the topic', () => {
    const ts = tasks();
    expect(renameTopic(ts, 'PERSO', 'Maison')).toBe(3);
    expect(ts.map(t => t.tags)).toEqual([['Maison'], ['Maison', 'travail'], ['Maison'], []]);
  });

  test('renaming to an existing topic merges, without a double tag', () => {
    const ts = tasks();
    renameTopic(ts, 'travail', 'perso');
    expect(ts[1].tags).toEqual(['Perso']);
  });

  test('every changed task is stamped, so sync sends it; the others are not', () => {
    const ts = tasks();
    renameTopic(ts, 'perso', 'Maison', '2026-10-29T10:00:00.000Z');
    expect(ts.map(t => t.updatedAt)).toEqual(['2026-10-29T10:00:00.000Z', '2026-10-29T10:00:00.000Z', '2026-10-29T10:00:00.000Z', undefined]);
    const ts2 = tasks();
    removeTopic(ts2, 'travail', 'X');
    expect(ts2.map(t => t.updatedAt)).toEqual([undefined, 'X', undefined, undefined]);
  });

  test('removing a topic removes the tag, never the task', () => {
    const ts = tasks();
    expect(removeTopic(ts, 'perso')).toBe(3);
    expect(ts).toHaveLength(4);
    expect(ts.map(t => t.tags)).toEqual([[], ['travail'], [], []]);
  });
});

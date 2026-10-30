import { describe, test, expect } from '@jest/globals';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedFromTasks, visible, lineForChange, createCompletionLog } from '../src/completions.js';

const task = (over = {}) => ({ id: 'a', title: 'Courses', tags: ['Maison'], status: 'not_started', ...over });

describe('completions — what was finished stays written', () => {
  test('a tick, then « to do » again, then a tick: one completion, the last', () => {
    const e = [
      lineForChange(task(), task({ status: 'done' }), '2026-10-01T10:00:00Z'),
      lineForChange(task({ status: 'done' }), task(), '2026-10-01T10:01:00Z'),
      lineForChange(task(), task({ status: 'done' }), '2026-10-05T09:00:00Z'),
    ];
    expect(visible(e).map(x => x.at)).toEqual(['2026-10-05T09:00:00Z']);
  });

  test('no line when the status does not cross done', () => {
    expect(lineForChange(task(), task({ status: 'in_progress' }), 'x')).toBeNull();
  });

  test('a repeating task keeps every past occurrence, newest first', () => {
    const e = ['2026-10-01', '2026-10-02', '2026-10-03'].map((d, i) =>
      lineForChange(task({ id: `r${i}`, recurring: 'daily' }), task({ id: `r${i}`, status: 'done', recurring: 'daily' }), `${d}T08:00:00Z`));
    expect(visible(e).map(x => x.taskId)).toEqual(['r2', 'r1', 'r0']);
    expect(e[0].recurring).toBe('daily');
  });

  test('seeding reads each task\'s history, a task that went back to « to do » included', () => {
    const seeded = seedFromTasks([
      task({ id: 'h', history: [{ at: '2026-10-02T00:00:00Z', type: 'status', from: 'not_started', to: 'done' },
                                { at: '2026-10-03T00:00:00Z', type: 'status', from: 'done', to: 'not_started' },
                                { at: '2026-10-09T00:00:00Z', type: 'status', from: 'not_started', to: 'done' }] }),
      task({ id: 'n', status: 'done', updatedAt: '2026-10-04T00:00:00Z' }),
      task({ id: 'o' }),
    ]);
    expect(visible(seeded).map(x => [x.taskId, x.at])).toEqual([['h', '2026-10-09T00:00:00Z'], ['n', '2026-10-04T00:00:00Z']]);
  });

  test('the register survives the task: append-only, seeded once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'clarity-completions-'));
    const log = createCompletionLog({ dataDir: dir });
    log.seedIfMissing([task({ id: 'x', status: 'done', updatedAt: '2026-09-01T00:00:00Z' })]);
    log.append(lineForChange(task(), task({ status: 'done' }), '2026-10-10T00:00:00Z'));
    log.seedIfMissing([]);   // already there: not seeded again
    expect(existsSync(log.file)).toBe(true);
    expect(visible(log.all()).map(x => x.taskId)).toEqual(['a', 'x']);
  });
});

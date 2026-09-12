import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Two shipped bugs came from the same omission: a route changed the task store
// and never told the profile. Nothing caught it, because the profile code was
// correct — the call site was simply absent, and a unit test on a pure function
// cannot see a caller that does not exist.
//
// So the invariant is checked where it lives: in the source of the routes.
// Every handler that writes the task store must also trigger a recompute,
// unless it only touches a field no metric reads — and each of those has to be
// named here, which is the point. Adding a route that quietly skips the
// recompute now requires editing this list and saying why.

const SERVER = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'server.js'), 'utf8');

// Fields the metrics actually read (see src/profile/metrics.js). A write that
// touches none of these cannot move a number.
const EXEMPT = {
  "post '/api/tasks/:id/timer/start'":
    'writes only timerStarted, which no metric reads — the elapsed time lands on timer/stop',
  "post '/api/weekly-summary'":
    'writes data.weeklySummary, never a task',
  "post '/api/tasks/:id/breakdown'":
    'writes subtasks and updatedAt; no metric reads either',
};

function routeHandlers() {
  const re = /^app\.(get|post|put|delete|patch)\('([^']+)'/gm;
  const starts = [...SERVER.matchAll(re)].map(m => ({
    key: `${m[1]} '${m[2]}'`, index: m.index,
  }));
  return starts.map((s, i) => ({
    ...s, body: SERVER.slice(s.index, i + 1 < starts.length ? starts[i + 1].index : SERVER.length),
  }));
}

describe('every route that writes tasks refreshes the profile', () => {
  const writers = routeHandlers().filter(r => /\bsaveData\(/.test(r.body));

  test('there are task-writing routes to check (the scan itself still works)', () => {
    expect(writers.length).toBeGreaterThan(5);
  });

  test.each(writers.map(r => [r.key, r]))('%s', (key, route) => {
    const recomputes = /(scheduleProfileRecompute|profileStore\.recompute)\(/.test(route.body);
    if (EXEMPT[key]) {
      // An exemption that has become wrong is worse than a missing one.
      expect(recomputes).toBe(false);
      return;
    }
    expect(recomputes).toBe(true);
  });

  test('clearing every task recomputes immediately, not on a debounce', () => {
    const all = routeHandlers().find(r => r.key === "delete '/api/tasks/all'");
    expect(all).toBeDefined();
    // A debounced pass can be lost if the app closes in the next second, and
    // the stale numbers it leaves behind describe tasks that no longer exist.
    expect(all.body).toMatch(/profileStore\.recompute\(/);
  });
});

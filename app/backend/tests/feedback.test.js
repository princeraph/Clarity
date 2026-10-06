import { describe, test, expect } from '@jest/globals';
import {
  createFeedback, normalizeConfig, isPromptDue, promptPatch, buildPayload,
  MAX_MESSAGE, RATE_LIMIT, PROMPT_AFTER_DONE,
} from '../src/feedback/feedback.js';
import { parseFormPage, responseUrlFrom } from '../tools/configurer-avis.mjs';

const CONFIG = {
  formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSabc/formResponse',
  fields: { rating: 'entry.1000001', message: 'entry.1000002', version: 'entry.1000003', system: 'entry.1000004' },
};
const EMPTY = { formUrl: '', fields: { rating: '', message: '', version: '', system: '' } };

// A fetch that records what it was given and answers like Google: 200 + HTML.
function fakeFetch({ status = 200, fail = null } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (fail) throw fail;
    return { status, ok: status >= 200 && status < 300, text: async () => '<html>Merci</html>' };
  };
  fn.calls = calls;
  return fn;
}

const make = (over = {}) => {
  const fetchImpl = over.fetchImpl || fakeFetch();
  const fb = createFeedback({ config: CONFIG, fetchImpl, version: '1.2.0', system: 'win32 10.0.22631', ...over });
  return { fb, fetchImpl };
};

describe('what is sent', () => {
  test('exactly the four form fields, and nothing else', async () => {
    const { fb, fetchImpl } = make();
    // Everything a careless caller could pass along: none of it may leave.
    const out = await fb.send({
      rating: 'up', message: '  Très clair.  ',
      tasks: [{ title: 'SECRET-TASK' }], settings: { apiKey: 'SECRET-KEY' }, notes: 'SECRET-NOTE',
    });
    expect(out).toEqual({ sent: true });
    expect(fetchImpl.calls).toHaveLength(1);
    const { url, init } = fetchImpl.calls[0];
    expect(url).toBe(CONFIG.formUrl);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toMatch(/^application\/x-www-form-urlencoded/);
    const body = new URLSearchParams(init.body);
    expect([...body.keys()].sort()).toEqual(['entry.1000001', 'entry.1000002', 'entry.1000003', 'entry.1000004']);
    expect(Object.fromEntries(body)).toEqual({
      'entry.1000001': '👍',
      'entry.1000002': 'Très clair.',
      'entry.1000003': '1.2.0',
      'entry.1000004': 'win32 10.0.22631',
    });
    expect(init.body).not.toMatch(/SECRET/);
  });

  test('no rating sends an empty rating field, a down vote 👎', async () => {
    const { fb, fetchImpl } = make();
    await fb.send({ rating: null, message: 'Rien à dire' });
    await fb.send({ rating: 'down', message: '' });
    expect(new URLSearchParams(fetchImpl.calls[0].init.body).get('entry.1000001')).toBe('');
    expect(new URLSearchParams(fetchImpl.calls[1].init.body).get('entry.1000001')).toBe('👎');
  });

  test('a field the form lacks is left out rather than sent under no name', () => {
    const cfg = normalizeConfig({ ...CONFIG, fields: { ...CONFIG.fields, system: '' } });
    const body = buildPayload(cfg, { rating: 'up', message: 'x', version: '1', system: 'linux' });
    expect([...body.keys()]).toEqual(['entry.1000001', 'entry.1000002', 'entry.1000003']);
  });

  test('a redirect (the form wants a Google sign-in) is not followed', async () => {
    const { fb, fetchImpl } = make();
    await fb.send({ message: 'x' });
    expect(fetchImpl.calls[0].init.redirect).toBe('manual');
  });
});

describe('input is checked', () => {
  test.each([
    [{ rating: 'meh', message: 'x' }, 'invalid-rating'],
    [{ message: 42 }, 'invalid-message'],
    [{ message: 'x'.repeat(MAX_MESSAGE + 1) }, 'too-long'],
    [{ rating: null, message: '   ' }, 'empty'],
  ])('%j is refused (%s) and nothing is posted', async (input, code) => {
    const { fb, fetchImpl } = make();
    await expect(fb.send(input)).rejects.toMatchObject({ status: 400, code });
    expect(fetchImpl.calls).toHaveLength(0);
  });

  test('exactly the maximum length is accepted', async () => {
    const { fb } = make();
    await expect(fb.send({ message: 'x'.repeat(MAX_MESSAGE) })).resolves.toEqual({ sent: true });
  });
});

describe('off until configured', () => {
  test.each([
    ['empty config', EMPTY],
    ['no config at all', undefined],
    ['form URL but no message field', { ...CONFIG, fields: { ...CONFIG.fields, message: '' } }],
    ['message field but no form URL', { ...CONFIG, formUrl: '' }],
    ['a form URL that is not a URL', { ...CONFIG, formUrl: 'not a url' }],
    ['a field that is not an entry id', { ...CONFIG, fields: { ...CONFIG.fields, message: 'message' } }],
  ])('%s → disabled, never due, sends nothing', async (_, config) => {
    const fetchImpl = fakeFetch();
    const fb = createFeedback({ config, fetchImpl });
    expect(fb.enabled).toBe(false);
    expect(fb.isDue({ firstUseAt: '2000-01-01T00:00:00Z' }, Array(10).fill({ status: 'done' }))).toBe(false);
    await expect(fb.send({ message: 'x' })).rejects.toMatchObject({ status: 404, code: 'disabled' });
    expect(fetchImpl.calls).toHaveLength(0);
  });

  test('the shipped feedback.json is empty, so a fresh clone sends nothing', async () => {
    const { readFileSync } = await import('fs');
    const shipped = JSON.parse(readFileSync(new URL('../feedback.json', import.meta.url), 'utf8'));
    expect(createFeedback({ config: shipped }).enabled).toBe(false);
  });

  test('a configured form is enabled', () => {
    expect(make().fb.enabled).toBe(true);
  });
});

describe('failures', () => {
  test('anything but 200 is a 502', async () => {
    const { fb } = make({ fetchImpl: fakeFetch({ status: 302 }) });
    await expect(fb.send({ message: 'x' })).rejects.toMatchObject({ status: 502, code: 'rejected' });
  });

  test('an unreachable form is a 502', async () => {
    const { fb } = make({ fetchImpl: fakeFetch({ fail: new Error('ENOTFOUND') }) });
    await expect(fb.send({ message: 'x' })).rejects.toMatchObject({ status: 502, code: 'unreachable' });
  });

  test('a form that never answers times out as a 502', async () => {
    const hang = (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
    });
    const { fb } = make({ fetchImpl: hang, timeoutMs: 20 });
    await expect(fb.send({ message: 'x' })).rejects.toMatchObject({ status: 502, code: 'timeout' });
  });
});

describe('rate limit', () => {
  test(`at most ${RATE_LIMIT} sends an hour, then 429 without posting; the window slides`, async () => {
    let t = Date.parse('2026-10-06T10:00:00Z');
    const { fb, fetchImpl } = make({ now: () => new Date(t) });
    for (let i = 0; i < RATE_LIMIT; i++) { await fb.send({ message: `m${i}` }); t += 60_000; }
    await expect(fb.send({ message: 'one too many' })).rejects.toMatchObject({ status: 429, code: 'rate-limited' });
    expect(fetchImpl.calls).toHaveLength(RATE_LIMIT);
    t = Date.parse('2026-10-06T11:00:00Z');          // the first send is now an hour old
    await expect(fb.send({ message: 'again' })).resolves.toEqual({ sent: true });
    await expect(fb.send({ message: 'and again' })).rejects.toMatchObject({ status: 429 });
  });

  test('a failed send does not use up the allowance', async () => {
    let status = 500;
    const fetchImpl = async () => ({ status, ok: status === 200 });
    const { fb } = make({ fetchImpl });
    for (let i = 0; i < RATE_LIMIT + 2; i++) await expect(fb.send({ message: 'x' })).rejects.toMatchObject({ status: 502 });
    status = 200;
    await expect(fb.send({ message: 'x' })).resolves.toEqual({ sent: true });
  });
});

describe('when Clarity asks on its own', () => {
  const NOW = new Date('2026-10-20T12:00:00Z');
  const WEEK_AGO = '2026-10-13T12:00:00Z';
  const done = (n) => Array.from({ length: n }, () => ({ status: 'done' }));
  const due = (settings, tasks = done(PROMPT_AFTER_DONE), enabled = true) => isPromptDue({ enabled, settings, tasks, now: NOW });

  test('due after 7 days and 5 finished tasks', () => {
    expect(due({ firstUseAt: WEEK_AGO })).toBe(true);
    expect(due({ firstUseAt: WEEK_AGO, feedbackPromptState: 'pending' })).toBe(true);
  });

  test('not before 7 days', () => {
    expect(due({ firstUseAt: '2026-10-13T12:00:01Z' })).toBe(false);
  });

  test('not before 5 finished tasks — open ones do not count, archived finished ones do', () => {
    expect(due({ firstUseAt: WEEK_AGO }, [...done(4), { status: 'in_progress' }, { status: 'not_started' }])).toBe(false);
    expect(due({ firstUseAt: WEEK_AGO }, [...done(4), { status: 'done', archived: true }])).toBe(true);
  });

  test('never without a first-use date', () => {
    expect(due({})).toBe(false);
    expect(due({ firstUseAt: 'garbage' })).toBe(false);
  });

  test('never when feedback is off', () => {
    expect(due({ firstUseAt: WEEK_AGO }, done(9), false)).toBe(false);
  });

  test('"done" and "never" are final', () => {
    expect(due({ firstUseAt: WEEK_AGO, feedbackPromptState: 'done' })).toBe(false);
    expect(due({ firstUseAt: WEEK_AGO, feedbackPromptState: 'never' })).toBe(false);
  });

  test('"later" waits 7 days, then asks again', () => {
    const later = promptPatch('later', new Date('2026-10-15T12:00:00Z'));
    expect(later).toEqual({ feedbackPromptState: 'snoozed', feedbackSnoozeUntil: '2026-10-22T12:00:00.000Z' });
    expect(due({ firstUseAt: WEEK_AGO, ...later })).toBe(false);
    expect(isPromptDue({ enabled: true, settings: { firstUseAt: WEEK_AGO, ...later }, tasks: done(5), now: new Date('2026-10-22T12:00:00Z') })).toBe(true);
  });

  test('the answers map to states, and anything else is a 400', () => {
    const now = new Date();
    expect(promptPatch('never', now).feedbackPromptState).toBe('never');
    expect(promptPatch('done', now).feedbackPromptState).toBe('done');
    expect(() => promptPatch('sometime', now)).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => promptPatch(undefined, now)).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('configurer-avis reads a public form page', () => {
  // The shape Google serves: questions under [1][1], each [id, title, desc, type, [[entry, choices, required]]].
  const data = [null, ['Aidez-nous à améliorer Clarity', [
    [111, 'Note', null, 0, [[1000001, null, 0]]],
    [222, 'Message', null, 1, [[1000002, null, 1]]],
    [333, 'Version', null, 0, [[1000003, null, 0]]],
    [444, 'Système', null, 0, [[1000004, null, 0]]],
    [555, 'Une section sans réponse', null, 8, null],
  ], null, null, null, null, null, null, 'Avis sur Clarity'],
  '/forms', 'Avis sur Clarity', null, null, null, '', null, 0, 0, null, '', 0, 'e/1FAIpQLSabc/formResponse', 0, '[]', 0, 0];
  const page = (d) => `<!DOCTYPE html><html><head><script type="text/javascript" nonce="n0">var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(d)};</script></head><body></body></html>`;
  const VIEW = 'https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform?usp=sf_link';

  test('finds the four entry ids and the response address', () => {
    const { config, warnings, title, found } = parseFormPage(page(data), VIEW);
    expect(config).toEqual(CONFIG);
    expect(title).toBe('Avis sur Clarity');
    expect(found.map(f => f.field)).toEqual(['rating', 'message', 'version', 'system']);
    expect(warnings).toEqual([]);
    // What it writes is what the backend accepts.
    expect(createFeedback({ config }).enabled).toBe(true);
  });

  test('English titles, any case, trailing decoration', () => {
    const en = structuredClone(data);
    en[1][1][0][1] = 'RATING (👍 / 👎)';
    en[1][1][1][1] = 'message:';
    en[1][1][3][1] = 'System';
    expect(parseFormPage(page(en), VIEW).config).toEqual(CONFIG);
  });

  test('a missing question and a required rating are reported', () => {
    const d = structuredClone(data);
    d[1][1].splice(3, 1);                 // no Système
    d[1][1][0][4][0][2] = 1;              // Note required
    const { config, warnings } = parseFormPage(page(d), VIEW);
    expect(config.fields.system).toBe('');
    expect(warnings.join('\n')).toMatch(/Système/);
    expect(warnings.join('\n')).toMatch(/obligatoire/);
  });

  test('a choice question is reported — Google would refuse free text', () => {
    const d = structuredClone(data);
    d[1][1][0][3] = 2;
    expect(parseFormPage(page(d), VIEW).warnings.join('\n')).toMatch(/texte libre/);
  });

  test('the editor link and a page without a form are refused with a reason', () => {
    expect(() => parseFormPage(page(data), 'https://docs.google.com/forms/d/abc123/edit')).toThrow(/éditeur/);
    expect(() => parseFormPage('<html>nothing</html>', VIEW)).toThrow(/FB_PUBLIC_LOAD_DATA_/);
  });

  test('the response address comes from the URL, or from the page when the URL lacks it', () => {
    expect(responseUrlFrom('https://docs.google.com/forms/u/0/d/e/XYZ_-1/viewform', null)).toBe('https://docs.google.com/forms/d/e/XYZ_-1/formResponse');
    expect(responseUrlFrom('https://forms.gle/short', data)).toBe(CONFIG.formUrl);
  });
});

import { describe, test, expect } from '@jest/globals';
import {
  createFeedback, normalizeConfig, isPromptDue, promptPatch, buildPayload, combineMessage,
  MAX_MESSAGE, RATE_LIMIT, PROMPT_AFTER_DONE,
} from '../src/feedback/feedback.js';
import { parseFormPage, responseUrlFrom, routeSummary } from '../tools/configurer-avis.mjs';

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

// The same form, with a question of its own for every comment category.
const DEDICATED = {
  formUrl: CONFIG.formUrl,
  fields: {
    ...CONFIG.fields,
    usability: 'entry.2000001', bugs: 'entry.2000002', suggestions: 'entry.2000003', other: 'entry.2000004',
  },
};
const bodyOf = (call) => Object.fromEntries(new URLSearchParams(call.init.body));

describe('what is sent — a form with only rating/message/version/system', () => {
  test('exactly the four form fields, the comments combined into the message, and nothing else', async () => {
    const { fb, fetchImpl } = make();
    // Everything a careless caller could pass along: none of it may leave.
    const out = await fb.send({
      rating: 4, usability: '  Très clair.  ', bugs: 'Le minuteur saute.\nÀ chaque fois.', suggestions: '', other: '   ',
      message: 'SECRET-LEGACY', tasks: [{ title: 'SECRET-TASK' }], settings: { apiKey: 'SECRET-KEY' }, notes: 'SECRET-NOTE',
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
      'entry.1000001': '4/5',
      'entry.1000002': 'Facilité d’utilisation :\nTrès clair.\n\nBugs :\nLe minuteur saute.\nÀ chaque fois.',
      'entry.1000003': '1.2.0',
      'entry.1000004': 'win32 10.0.22631',
    });
    expect(init.body).not.toMatch(/SECRET/);
  });

  test('all four categories, in order, each under its French heading', () => {
    const cfg = normalizeConfig(CONFIG);
    expect(combineMessage(cfg, { usability: 'a', bugs: 'b', suggestions: 'c', other: 'd' }))
      .toBe('Facilité d’utilisation :\na\n\nBugs :\nb\n\nSuggestions :\nc\n\nAutres commentaires :\nd');
    expect(combineMessage(cfg, { other: 'seul' })).toBe('Autres commentaires :\nseul');
    expect(combineMessage(cfg, {})).toBe('');
  });

  test('stars only: an empty message; no stars: an empty rating', async () => {
    const { fb, fetchImpl } = make();
    await fb.send({ rating: 5 });
    await fb.send({ rating: null, suggestions: 'Un mode sombre' });
    expect(bodyOf(fetchImpl.calls[0])).toMatchObject({ 'entry.1000001': '5/5', 'entry.1000002': '' });
    expect(bodyOf(fetchImpl.calls[1])).toMatchObject({ 'entry.1000001': '', 'entry.1000002': 'Suggestions :\nUn mode sombre' });
  });

  test('a field the form lacks is left out rather than sent under no name', () => {
    const cfg = normalizeConfig({ ...CONFIG, fields: { ...CONFIG.fields, system: '' } });
    const body = buildPayload(cfg, { rating: 1, other: 'x', version: '1', system: 'linux' });
    expect([...body.keys()]).toEqual(['entry.1000001', 'entry.1000002', 'entry.1000003']);
  });

  test('a redirect (the form wants a Google sign-in) is not followed', async () => {
    const { fb, fetchImpl } = make();
    await fb.send({ other: 'x' });
    expect(fetchImpl.calls[0].init.redirect).toBe('manual');
  });
});

describe('what is sent — a form with a question per category', () => {
  test('each category goes to its own field; message stays empty', async () => {
    const { fb, fetchImpl } = make({ config: DEDICATED });
    await fb.send({ rating: 3, usability: 'u', bugs: 'b', suggestions: 's', other: 'o', tasks: ['SECRET'] });
    const body = new URLSearchParams(fetchImpl.calls[0].init.body);
    expect([...body.keys()]).toEqual([
      'entry.1000001', 'entry.1000002',
      'entry.2000001', 'entry.2000002', 'entry.2000003', 'entry.2000004',
      'entry.1000003', 'entry.1000004',
    ]);
    expect(Object.fromEntries(body)).toEqual({
      'entry.1000001': '3/5', 'entry.1000002': '',
      'entry.2000001': 'u', 'entry.2000002': 'b', 'entry.2000003': 's', 'entry.2000004': 'o',
      'entry.1000003': '1.2.0', 'entry.1000004': 'win32 10.0.22631',
    });
    expect(fetchImpl.calls[0].init.body).not.toMatch(/SECRET/);
  });

  test('mixed: dedicated categories go apart, the rest is combined into message', async () => {
    const config = { formUrl: CONFIG.formUrl, fields: { ...CONFIG.fields, bugs: 'entry.2000002' } };
    const { fb, fetchImpl } = make({ config });
    await fb.send({ rating: null, usability: 'u', bugs: 'b', suggestions: 's' });
    const body = bodyOf(fetchImpl.calls[0]);
    expect(Object.keys(body).sort()).toEqual(['entry.1000001', 'entry.1000002', 'entry.1000003', 'entry.1000004', 'entry.2000002']);
    expect(body['entry.2000002']).toBe('b');
    expect(body['entry.1000002']).toBe('Facilité d’utilisation :\nu\n\nSuggestions :\ns');
  });

  test('without a message field, it is on only when all four categories have their own', async () => {
    const noMessage = { ...DEDICATED, fields: { ...DEDICATED.fields, message: '' } };
    const { fb, fetchImpl } = make({ config: noMessage });
    expect(fb.enabled).toBe(true);
    await fb.send({ bugs: 'b' });
    expect(Object.keys(bodyOf(fetchImpl.calls[0]))).not.toContain('entry.1000002');
    const three = { ...noMessage, fields: { ...noMessage.fields, other: '' } };
    expect(createFeedback({ config: three }).enabled).toBe(false);
  });
});

describe('input is checked', () => {
  test.each([
    [{ rating: 'up', other: 'x' }, 'invalid-rating'],
    [{ rating: 0 }, 'invalid-rating'],
    [{ rating: 6 }, 'invalid-rating'],
    [{ rating: 3.5 }, 'invalid-rating'],
    [{ rating: '4' }, 'invalid-rating'],
    [{ bugs: 42 }, 'invalid-text'],
    [{ rating: 4, suggestions: ['x'] }, 'invalid-text'],
    [{ usability: 'x'.repeat(MAX_MESSAGE + 1) }, 'too-long'],
    [{ rating: 5, other: 'x'.repeat(MAX_MESSAGE + 1) }, 'too-long'],
    [{ rating: null, usability: '   ', bugs: '', suggestions: '\n' }, 'empty'],
    [{}, 'empty'],
    [{ message: 'the old shape is not read' }, 'empty'],
  ])('%j is refused (%s) and nothing is posted', async (input, code) => {
    const { fb, fetchImpl } = make();
    await expect(fb.send(input)).rejects.toMatchObject({ status: 400, code });
    expect(fetchImpl.calls).toHaveLength(0);
  });

  test.each([1, 2, 3, 4, 5])('%i star(s) alone is enough', async (n) => {
    const { fb, fetchImpl } = make();
    await expect(fb.send({ rating: n })).resolves.toEqual({ sent: true });
    expect(bodyOf(fetchImpl.calls[0])['entry.1000001']).toBe(`${n}/5`);
  });

  test('exactly the maximum length is accepted, in every field at once', async () => {
    const { fb } = make();
    const full = 'x'.repeat(MAX_MESSAGE);
    await expect(fb.send({ usability: full, bugs: full, suggestions: full, other: full })).resolves.toEqual({ sent: true });
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
    await expect(fb.send({ other: 'x' })).rejects.toMatchObject({ status: 404, code: 'disabled' });
    expect(fetchImpl.calls).toHaveLength(0);
  });

  // Configured on 6 October (the owner's « Avis Clarity » form). What ships must
  // still be either nothing, or a Google Form with all four fields — never an
  // address that is not Google's, and never a half-filled config.
  test('the shipped feedback.json is empty, or a complete Google Form', async () => {
    const { readFileSync } = await import('fs');
    const shipped = JSON.parse(readFileSync(new URL('../feedback.json', import.meta.url), 'utf8'));
    if (!shipped.formUrl) {
      expect(createFeedback({ config: shipped }).enabled).toBe(false);
      return;
    }
    expect(shipped.formUrl).toMatch(/^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/);
    for (const k of ['rating', 'message', 'version', 'system']) expect(shipped.fields[k]).toMatch(/^entry\.\d+$/);
    expect(createFeedback({ config: shipped }).enabled).toBe(true);
  });

  test('a configured form is enabled', () => {
    expect(make().fb.enabled).toBe(true);
  });
});

describe('failures', () => {
  test('anything but 200 is a 502', async () => {
    const { fb } = make({ fetchImpl: fakeFetch({ status: 302 }) });
    await expect(fb.send({ other: 'x' })).rejects.toMatchObject({ status: 502, code: 'rejected' });
  });

  test('an unreachable form is a 502', async () => {
    const { fb } = make({ fetchImpl: fakeFetch({ fail: new Error('ENOTFOUND') }) });
    await expect(fb.send({ other: 'x' })).rejects.toMatchObject({ status: 502, code: 'unreachable' });
  });

  test('a form that never answers times out as a 502', async () => {
    const hang = (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
    });
    const { fb } = make({ fetchImpl: hang, timeoutMs: 20 });
    await expect(fb.send({ other: 'x' })).rejects.toMatchObject({ status: 502, code: 'timeout' });
  });
});

describe('rate limit', () => {
  test(`at most ${RATE_LIMIT} sends an hour, then 429 without posting; the window slides`, async () => {
    let t = Date.parse('2026-10-06T10:00:00Z');
    const { fb, fetchImpl } = make({ now: () => new Date(t) });
    for (let i = 0; i < RATE_LIMIT; i++) { await fb.send({ other: `m${i}` }); t += 60_000; }
    await expect(fb.send({ other: 'one too many' })).rejects.toMatchObject({ status: 429, code: 'rate-limited' });
    expect(fetchImpl.calls).toHaveLength(RATE_LIMIT);
    t = Date.parse('2026-10-06T11:00:00Z');          // the first send is now an hour old
    await expect(fb.send({ other: 'again' })).resolves.toEqual({ sent: true });
    await expect(fb.send({ other: 'and again' })).rejects.toMatchObject({ status: 429 });
  });

  test('a failed send does not use up the allowance', async () => {
    let status = 500;
    const fetchImpl = async () => ({ status, ok: status === 200 });
    const { fb } = make({ fetchImpl });
    for (let i = 0; i < RATE_LIMIT + 2; i++) await expect(fb.send({ other: 'x' })).rejects.toMatchObject({ status: 502 });
    status = 200;
    await expect(fb.send({ other: 'x' })).resolves.toEqual({ sent: true });
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

  // The four optional category questions, titled the way a person would type them.
  const withCategories = (titles) => {
    const d = structuredClone(data);
    d[1][1].splice(2, 0, ...titles.map((t, i) => [600 + i, t, null, 1, [[2000001 + i, null, 0]]]));
    return d;
  };

  test('the four category questions, French titles with accents and a curly apostrophe', () => {
    const d = withCategories(['Facilité d’utilisation', 'Bugs', 'Suggestions', 'Autres commentaires']);
    const { config, warnings, found } = parseFormPage(page(d), VIEW);
    expect(config).toEqual(DEDICATED);
    expect(Object.keys(config.fields)).toEqual(['rating', 'message', 'usability', 'bugs', 'suggestions', 'other', 'version', 'system']);
    expect(found.map(f => f.field)).toEqual(['rating', 'message', 'usability', 'bugs', 'suggestions', 'other', 'version', 'system']);
    expect(warnings).toEqual([]);
    expect(routeSummary(config.fields).every(l => /sa propre question/.test(l))).toBe(true);
  });

  test('English titles, any case, no accents, trailing decoration', () => {
    const d = withCategories(['USABILITY', 'bugs:', 'Suggestions (optional)', 'Other comments?']);
    expect(parseFormPage(page(d), VIEW).config).toEqual(DEDICATED);
    const fr = withCategories(["FACILITE D'UTILISATION", 'Bug', 'suggestion', 'autres  commentaires']);
    expect(parseFormPage(page(fr), VIEW).config).toEqual(DEDICATED);
  });

  test('some categories only: those get a field, the summary sends the rest to Message', () => {
    const d = withCategories(['Bugs', 'Suggestions']);
    const { config, warnings } = parseFormPage(page(d), VIEW);
    expect(config.fields).toEqual({ ...CONFIG.fields, bugs: 'entry.2000001', suggestions: 'entry.2000002' });
    expect(warnings).toEqual([]);                    // a missing category is not a problem
    const summary = routeSummary(config.fields);
    expect(summary[0]).toMatch(/Facilité d’utilisation.*regroupée dans « Message » \(entry\.1000002\)/);
    expect(summary[1]).toMatch(/Bugs.*sa propre question \(entry\.2000001\)/);
    expect(summary[3]).toMatch(/Autres commentaires.*regroupée dans « Message »/);
    expect(createFeedback({ config }).enabled).toBe(true);
  });

  test('no Message is fine when all four categories have their own question, and only then', () => {
    const all = withCategories(['Facilité d’utilisation', 'Bugs', 'Suggestions', 'Autres commentaires']);
    all[1][1].splice(1, 1);                          // no Message
    const { config, warnings } = parseFormPage(page(all), VIEW);
    expect(config.fields.message).toBe('');
    expect(warnings).toEqual([]);
    expect(createFeedback({ config }).enabled).toBe(true);

    const three = withCategories(['Bugs', 'Suggestions', 'Autres commentaires']);
    three[1][1].splice(1, 1);
    const out = parseFormPage(page(three), VIEW);
    expect(out.warnings.join('\n')).toMatch(/Message/);
    expect(routeSummary(out.config.fields)[0]).toMatch(/nulle part/);
    expect(createFeedback({ config: out.config }).enabled).toBe(false);
  });

  test('a required category question is reported', () => {
    const d = withCategories(['Bugs']);
    d[1][1][2][4][0][2] = 1;
    expect(parseFormPage(page(d), VIEW).warnings.join('\n')).toMatch(/« Bugs » est obligatoire/);
  });

  test('the response address comes from the URL, or from the page when the URL lacks it', () => {
    expect(responseUrlFrom('https://docs.google.com/forms/u/0/d/e/XYZ_-1/viewform', null)).toBe('https://docs.google.com/forms/d/e/XYZ_-1/formResponse');
    expect(responseUrlFrom('https://forms.gle/short', data)).toBe(CONFIG.formUrl);
  });
});

import { describe, test, expect } from '@jest/globals';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createProfileStore, emptyProfile } from '../src/profile/store.js';

// 2.6.0: « Clarity suggests » was felt as pushy — up to 6 interruptions a day.
// The default is now once a day. A profile still on the old defaults moves once;
// one the person changed keeps its setting.
describe('calmer suggestion defaults', () => {
  const quiet = { log() {}, warn() {}, error() {} };
  const withPrefs = (preferences) => {
    const dir = mkdtempSync(join(tmpdir(), 'clarity-prefs-'));
    const p = emptyProfile();
    writeFileSync(join(dir, 'profile.json'), JSON.stringify({ ...p, preferences }));
    return createProfileStore({ dataDir: dir, log: quiet }).readProfile().preferences;
  };

  test('a new profile volunteers once a day', () => {
    expect(emptyProfile().preferences.suggestionMode).toBe('daily');
  });

  test('a profile left on the old defaults moves to once a day', () => {
    expect(withPrefs({ suggestionMode: 'active', maxSuggestionsPerDay: 6, minGapMinutes: 90, quiet: [] }).suggestionMode).toBe('daily');
  });

  test('a budget the person changed is a choice: it stays active', () => {
    expect(withPrefs({ suggestionMode: 'active', maxSuggestionsPerDay: 3, minGapMinutes: 90, quiet: [] }).suggestionMode).toBe('active');
  });

  test('once moved, « active » chosen again stays active', () => {
    expect(withPrefs({ suggestionMode: 'active', maxSuggestionsPerDay: 6, suggestionDefaults: 2, quiet: [] }).suggestionMode).toBe('active');
  });
});

import { describe, test, expect } from '@jest/globals';
import { mkdtempSync, appendFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createProfileStore } from '../src/profile/store.js';

// "Clear conversation history" (Settings › Privacy) was a button with nothing
// behind it. It now removes the conversations from the journal — and only
// them: corrections and observations feed the profile and must stay.
describe('clearing the conversation history', () => {
  const quiet = { log() {}, warn() {}, error() {} };

  test('removes every conversation and nothing else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'clarity-journal-'));
    const store = createProfileStore({ dataDir: dir, log: quiet });
    store.appendEntry({ kind: 'exchange', message: 'Je bloque sur le devis', reply: 'Commence par…' });
    store.appendEntry({ kind: 'correction', text: 'Le devis n’est pas urgent' });
    store.appendEntry({ kind: 'exchange', message: 'Et demain ?', reply: 'Le garage.' });
    appendFileSync(store.JOURNAL_FILE, 'pas du json\n');   // a damaged line

    expect(store.removeEntries(['exchange'])).toBe(2);
    expect(store.readEntries({ kinds: ['exchange'] }).entries).toHaveLength(0);
    expect(store.readEntries({ kinds: ['correction'] }).entries).toHaveLength(1);
    // what cannot be read is not deleted blind
    expect(readFileSync(store.JOURNAL_FILE, 'utf8')).toContain('pas du json');
  });

  test('an empty or missing journal is not an error', () => {
    const store = createProfileStore({ dataDir: mkdtempSync(join(tmpdir(), 'clarity-journal-')), log: quiet });
    expect(store.removeEntries(['exchange'])).toBe(0);
  });
});

import { describe, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// The installer speaks the language chosen in Clarity. Three files must agree
// for that, and nothing but this test ties them: the app writes the choice
// (electron/main.js), the installer reads it (build/installer.nsh), and the
// installer must carry every language the app offers (package.json).
const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(APP, ...p), 'utf8');

describe('the language of the installer', () => {
  const main = read('electron', 'main.js');
  const nsh = read('build', 'installer.nsh');
  const pkg = JSON.parse(read('package.json'));
  const appLanguages = readdirSync(join(APP, 'frontend', 'src', 'locales'))
    .filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));

  test('the installer reads the file the app writes', () => {
    const file = /const LOCALE_FILE = '([^']+)'/.exec(main)?.[1];
    expect(file).toBeTruthy();
    expect(nsh).toContain(`$APPDATA\\\${PRODUCT_NAME}\\${file}`);
  });

  test('every language of the app is in the installer, and understood by it', () => {
    const shipped = pkg.build.nsis.installerLanguages.map(l => l.slice(0, 2));
    for (const lang of appLanguages) {
      expect(shipped).toContain(lang);
      expect(nsh).toMatch(new RegExp(`\\$1 == "${lang}"`));
    }
  });

  test('English is the fallback for a Windows that speaks none of them', () => {
    expect(pkg.build.nsis.installerLanguages[0]).toBe('en_US');
  });
});

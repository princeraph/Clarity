import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// A pinned Clarity came unpinned after each close or update: the window and
// the installer's shortcut did not carry the same Windows identity. The two
// live in different files, so the only thing that keeps them equal is this.
const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the Windows identity of Clarity', () => {
  test('the window declares the same AppUserModelID as the installer’s shortcuts', () => {
    const appId = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')).build.appId;
    const main = readFileSync(join(APP, 'electron', 'main.js'), 'utf8');
    const declared = /const APP_USER_MODEL_ID = '([^']+)'/.exec(main)?.[1];
    expect(declared).toBe(appId);
    expect(main).toMatch(/app\.setAppUserModelId\(APP_USER_MODEL_ID\)/);
  });
});

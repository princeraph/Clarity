// The keyboard shortcuts: their default keys, the person's own (Settings ›
// Keyboard, kept in localStorage), and how a key press is matched. Shared by
// App (which answers them) and the cheat sheet (which lists them), so the
// sheet says what works, not what used to.

export const DEFAULT_SHORTCUT_KEYS = {
  capture:  ['Ctrl', 'K'],
  chat:     ['Ctrl', '/'],
  theme:    ['Ctrl', 'Shift', 'L'],
  settings: ['Ctrl', ','],
  focus:    ['Ctrl', '1'],
  tasks:    ['Ctrl', '2'],
  calendar: ['Ctrl', '3'],
  graph:    ['Ctrl', 'G'],
  // In a list, on the task that has the focus (Settings › Keyboard listed
  // these three long before anything answered them).
  complete: ['Space'],
  detail:   ['↵'],
  delete:   ['Del'],
};

export function getShortcutKeys(id) {
  try {
    const custom = JSON.parse(localStorage.getItem('clarity-shortcuts') || '{}');
    return custom[id] || DEFAULT_SHORTCUT_KEYS[id] || [];
  } catch { return DEFAULT_SHORTCUT_KEYS[id] || []; }
}

export function keysMatchEvent(e, keys) {
  const hasCtrl  = keys.includes('Ctrl');
  const hasShift = keys.includes('Shift');
  const hasAlt   = keys.includes('Alt');
  const mainKey  = keys.find(k => !['Ctrl', 'Shift', 'Alt'].includes(k));
  if (!mainKey) return false;
  if (hasCtrl  !== (e.ctrlKey || e.metaKey)) return false;
  if (hasShift !== e.shiftKey)  return false;
  if (hasAlt   !== e.altKey)    return false;
  const ek = e.key;
  if (mainKey === 'Space')     return ek === ' ';
  if (mainKey === 'Esc')       return ek === 'Escape';
  if (mainKey === '↵')         return ek === 'Enter';
  if (mainKey === 'Del')       return ek === 'Delete';
  if (mainKey === 'Backspace') return ek === 'Backspace';
  return ek.toUpperCase() === mainKey.toUpperCase() || ek === mainKey;
}

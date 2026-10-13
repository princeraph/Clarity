// What a POST /api/settings value means for a stored secret (apiKey,
// tunnelSecret). One slot is shared by every cloud provider, and the
// Settings screen clears its key field when the provider changes — so an
// empty string reached the server and was written over the real key.
// Measured before the fix: a saved key, a provider switch, a save → ''.
//
//   undefined, '', '••••••••', anything not a string → keep what is stored
//   null                                             → clear it, on purpose
//   any other string                                 → store it (trimmed)
//
// Returns { set: false } to keep, { set: true, value } to write.

export const MASK = '••••••••';

export function secretField(value) {
  if (value === null) return { set: true, value: '' };
  if (typeof value !== 'string') return { set: false };
  const v = value.trim();
  if (!v || v === MASK) return { set: false };
  return { set: true, value: v };
}

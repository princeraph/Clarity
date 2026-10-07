import { useSyncExternalStore } from 'react';

// The "Features" switches of Settings › AI assistant, saved in settings.json
// (backend/src/reschedule.js holds the defaults). They used to live in the
// Settings screen's own state: saved nowhere, read by nothing, and back to
// their defaults at every launch. One store, so a switch flipped in Settings
// reaches the Focus view and the chat without a reload.

const API = 'http://localhost:3001/api';
let features = null;
let loading = false;
const subscribers = new Set();
const notify = () => subscribers.forEach(fn => fn());

function load() {
  if (loading || features) return;
  loading = true;
  fetch(`${API}/settings`).then(r => (r.ok ? r.json() : null))
    .then(s => { if (s?.features) { features = s.features; notify(); } })
    .catch(() => {})
    .finally(() => { loading = false; });
}

function subscribe(fn) {
  subscribers.add(fn);
  load();
  return () => subscribers.delete(fn);
}

/** The saved switches, or null until they are read. */
export function useFeatures() {
  return useSyncExternalStore(subscribe, () => features);
}

/** Saves one switch. Resolves to the server's answer, or null if it failed (and the switch goes back). */
export async function setFeature(key, value) {
  const before = features;
  features = { ...(features || {}), [key]: value };
  notify();
  try {
    const r = await fetch(`${API}/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: { [key]: value } }),
    });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    features = before;
    notify();
    return null;
  }
}

import { useSyncExternalStore } from 'react';

// One place that listens to the updater (electron/updateFlow.js), shared by
// the title-bar pill and the update window. Two listeners would each ask main
// for its status, and "Clarity is up to date" is handed out only once.
//
// The window opens on its own only for the check made as Clarity opens; a
// version found hours later shows the pill, and the pill opens the window.

let snap = { state: null, updated: null, open: false };
const subscribers = new Set();
let started = false;
let dismissed = null;   // the version the person put off, this session

function set(patch) {
  snap = { ...snap, ...patch };
  subscribers.forEach(fn => fn());
}

function receive(state) {
  if (!state) return;
  const announce = state.atStartup && dismissed !== state.version
    && (state.phase === 'downloading' || state.phase === 'ready');
  set({ state, open: snap.open || announce || state.wanted || state.phase === 'installing' });
}

function start() {
  if (started) return;
  started = true;
  const u = window.clarity?.updates;
  if (!u) return;
  u.status().then(r => {
    if (r?.updated) set({ updated: r.updated });
    receive(r?.state);
  }).catch(() => {});
  u.onState(receive);
}

function subscribe(fn) {
  start();
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function useUpdates() {
  return useSyncExternalStore(subscribe, () => snap);
}

export const updates = {
  open: () => set({ open: true }),
  now: (words) => window.clarity?.updates?.now(words),
  later() {
    dismissed = snap.state?.version || null;
    set({ open: false });
    window.clarity?.updates?.later();
  },
  closeUpdated: () => set({ updated: null }),
};

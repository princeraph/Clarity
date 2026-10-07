// What the glance surfaces share — the tray panel (TrayMenu.jsx) and the card
// shown on wake (WakeCard.jsx): the dark palette of the taskbar, and which
// tasks count as "at hand".

export const MAX_TASKS = 5;

// Always-dark palette — the tray popup lives against the Windows taskbar,
// which is dark regardless of the app theme. Values mirror system-tray.jsx.
export const C = {
  cardBg:      'rgba(28, 28, 34, 0.98)',
  border:      'rgba(255,255,255,0.10)',
  divider:     'rgba(255,255,255,0.07)',
  tileBg:      'rgba(255,255,255,0.05)',
  hoverBg:     'rgba(255,255,255,0.06)',
  ink90:       'rgba(255,255,255,0.90)',
  ink82:       'rgba(255,255,255,0.82)',
  ink78:       'rgba(255,255,255,0.78)',
  ink45:       'rgba(255,255,255,0.45)',
  ink40:       'rgba(255,255,255,0.40)',
  ink35:       'rgba(255,255,255,0.35)',
  ink30:       'rgba(255,255,255,0.30)',
  kbdBg:       'rgba(255,255,255,0.06)',
  kbdBorder:   'rgba(255,255,255,0.08)',
  accent:      'oklch(0.68 0.13 258)',
  fontUI:      '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontMono:    '"Geist Mono", ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
};

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// What is at hand: overdue first, then today, then — if that leaves room —
// what comes next, in the order of the latest analysis or else by deadline.
export function tasksAtHand(tasks, analysis, max = MAX_TASKS) {
  const today = todayStr();
  const live = tasks.filter(t => !t.archived && t.status !== 'done');
  const rank = new Map((analysis?.taskAnalysis || []).map(a => [a.id, a.priority ?? 99]));
  const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99');
  const isOverdue = (t) => !!t.deadline && t.deadline.localeCompare(today) === -1;
  const overdue = live.filter(isOverdue).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const dueToday = live.filter(t => t.deadline === today).sort(byTime);
  const taken = new Set([...overdue, ...dueToday].map(t => t.id));
  const next = live.filter(t => !taken.has(t.id)).sort((a, b) =>
    (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99) || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  let room = max;
  const take = (list) => { const out = list.slice(0, Math.max(0, room)); room -= out.length; return out; };
  return { overdue: take(overdue), today: take(dueToday), next: take(next), total: live.length };
}


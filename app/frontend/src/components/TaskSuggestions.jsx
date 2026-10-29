import { useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { LEVEL_STYLE } from '../lib/niveaux.js';
import { dismissedAfter } from '../lib/suggestions.js';

// « Clarity suggests » in a task's details (1.9.0): each proposal with why,
// and Confirm / Not now / Never for this. Nothing changes without a click.
// The proposals themselves come from lib/suggestions.js, attached by App.
const API = 'http://localhost:3001/api';

async function put(id, body) {
  const r = await fetch(`${API}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(String(r.status));
}

export default function TaskSuggestions({ task, allTasks, T, onSaved, onEdited, onBreakdown }) {
  const { t, fmtDuration, fmtHours } = useLocale();
  const [busy, setBusy] = useState(null);
  // 2.6.0, calmer: what was proposed when the details opened, and nothing
  // more while they stay open — the analysis re-runs after each change, and
  // proposals used to appear and move under the person's eyes. One at a time;
  // the others behind « N more ».
  const [frozen] = useState(() => new Set((task.suggestions || []).map(s => s.key)));
  const [all, setAll] = useState(false);
  const pending = (task.suggestions || []).filter(s => frozen.has(s.key));
  const list = all ? pending : pending.slice(0, 1);
  if (!pending.length || task.status === 'done') return null;

  const title = (id) => allTasks.find(x => x.id === id)?.title || '…';
  const minutes = (m) => (m >= 60 ? fmtHours(m) : fmtDuration(m));

  function sentence(s) {
    if (s.kind === 'link') {
      const key = s.link.type === 'related' ? 'propose.linkRelated' : s.link.strength === 'soft' ? 'propose.linkSoft' : 'propose.linkHard';
      return t(key, { other: title(s.other) });
    }
    if (s.kind === 'level') return t('propose.level', { level: t(LEVEL_STYLE[s.value].key) });
    if (s.kind === 'difficulty') return t('propose.difficulty', { n: s.value, label: t(`difficulty.${s.value}`) });
    if (s.kind === 'heavy') return t('propose.heavy', { n: s.vars.n });
    if (s.kind === 'lower') return t('propose.lower', { level: t(LEVEL_STYLE[s.value].key) });
    return '';
  }
  // A fixed rule says its numbers; the assistant says its reason.
  function why(s) {
    if (s.kind === 'heavy' || s.kind === 'lower') {
      const parts = [];
      if (s.vars.minutes) parts.push(minutes(s.vars.minutes));
      if (s.vars.difficulty) parts.push(t('propose.whyDifficulty', { n: s.vars.difficulty }));
      if (s.kind === 'heavy') parts.push(t('propose.whyHolds', { n: s.vars.n }));
      if (s.kind === 'lower' && s.vars.reports >= 3) parts.push(t('propose.whyReports', { n: s.vars.reports }));
      else if (s.kind === 'lower') parts.push(t('propose.whyIdle', { n: s.vars.days }));
      return parts.join(' · ');
    }
    return s.why || '';
  }

  async function confirm(s, which = s.apply) {
    setBusy(s.key);
    try {
      if (which.action === 'breakdown') { onBreakdown?.(); return; }
      const owner = allTasks.find(x => x.id === which.taskId) || task;
      await put(which.taskId, which.patch);
      onSaved?.();
      onEdited?.(owner, which.patch);
    } catch { /* the toast of the failed save is the panel's */ }
    finally { setBusy(null); }
  }
  async function setAside(s, never) {
    setBusy(s.key);
    try { await put(task.id, { dismissed: dismissedAfter(task, s, Date.now(), never) }); onSaved?.(); }
    catch {} finally { setBusy(null); }
  }

  const btn = (primary) => ({
    padding: '4px 10px', fontSize: 12, fontFamily: T.fontUI, borderRadius: T.r6, cursor: 'pointer',
    ...(primary ? { background: T.ink, color: T.paper, border: 'none' } : { background: 'transparent', color: T.ink60, border: `1px solid ${T.hairline}` }),
  });

  return (
    <div data-suggestions style={{ padding: '12px 14px', background: T.accentSoft, border: `1px solid ${T.hairline}`, borderRadius: T.r10 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.accentInk, marginBottom: 8 }}>
        ✦ {t('propose.title')}
      </div>
      {list.map(s => (
        <div key={s.key} data-suggestion={s.kind} style={{ padding: '8px 0', borderTop: `1px solid ${T.hairlineSoft}`, opacity: busy === s.key ? 0.5 : 1 }}>
          <div style={{ fontSize: 13, color: T.ink }}>{sentence(s)}</div>
          {why(s) && <div style={{ fontSize: 12, color: T.ink60, marginTop: 2 }}>{why(s)}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <button type="button" data-act="confirm" disabled={!!busy} onClick={() => confirm(s)} style={btn(true)}>
              {s.kind === 'heavy' ? t('propose.breakdown') : t('propose.confirm')}
            </button>
            {s.alt && (
              <button type="button" data-act="alt" disabled={!!busy} onClick={() => confirm(s, s.alt)} style={btn(false)}>{t('propose.soften')}</button>
            )}
            <button type="button" data-act="later" disabled={!!busy} onClick={() => setAside(s, false)} style={btn(false)}>{t('propose.notNow')}</button>
            <button type="button" data-act="never" disabled={!!busy} onClick={() => setAside(s, true)} style={btn(false)}>{t('propose.never')}</button>
          </div>
        </div>
      ))}
      {!all && pending.length > 1 && (
        <button type="button" data-act="more" onClick={() => setAll(true)} style={{ ...btn(false), border: 'none', padding: '4px 0', color: T.accentInk }}>
          {t(pending.length === 2 ? 'propose.moreOne' : 'propose.more', { n: pending.length - 1 })}
        </button>
      )}
    </div>
  );
}

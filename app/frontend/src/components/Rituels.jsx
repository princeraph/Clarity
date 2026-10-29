import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useBackdropClose } from '../hooks/useBackdropClose.js';
import useEscape from '../hooks/useEscape.js';
import { dateOrderFor } from '../lib/saisie.js';
import {
  leftovers, todayTasks, candidatesForToday, doneOn, capacity, moveTo, parseDump, planSteps, dayOf,
} from '../lib/rituels.js';

// The day's rituals (2.7.0): plan the morning, shut down the evening, empty
// one's head. Each is a window opened on purpose — from Today, or the sidebar
// for the brain dump — never on its own. Every choice is saved as it is made:
// closing halfway keeps what was decided. What each choice means is
// lib/rituels.js's moveTo.

const API = 'http://localhost:3001/api';
const put = (id, body) => fetch(`${API}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// localStorage, per device: when each ritual was last done. Read with care —
// a private window or a blocked store must not break the page.
export const RITUAL_KEYS = { planned: 'clarity-plannedOn', shutdown: 'clarity-shutdownOn', review: 'clarity-somedayReview' };
export const readMark = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const writeMark = (k, v) => { try { localStorage.setItem(k, v); } catch { /* the ritual still worked */ } };

function useEstimation() {
  const [profile, setProfile] = useState(null);
  useEffect(() => { fetch(`${API}/profile`).then(r => r.json()).then(setProfile).catch(() => {}); }, []);
  return useMemo(() => {
    const e = profile?.observed?.estimation;
    if (!e) return {};
    const byArea = Object.fromEntries(Object.entries(e.byArea || {}).filter(([, v]) => v?.enough).map(([k, v]) => [k, v.medianRatio]));
    return { overall: e.enough ? e.medianRatio : null, byArea };
  }, [profile]);
}
function useWorkday() {
  const [w, setW] = useState(null);
  useEffect(() => { fetch(`${API}/settings`).then(r => r.json()).then(s => setW(s.workday || null)).catch(() => {}); }, []);
  return w;
}

function Shell({ title, subtitle, onClose, children, footer, testId }) {
  useEscape(onClose);
  const backdrop = useBackdropClose(onClose);
  const { T } = useTheme();
  const { t } = useLocale();
  return (
    <div className="clarity-backdrop" {...backdrop} style={{ position: 'fixed', inset: 0, background: 'rgba(25,25,26,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: T.fontUI }}>
      <div role="dialog" aria-modal="true" aria-label={title} data-ritual={testId} style={{
        background: T.paper, borderRadius: T.r14, border: `1px solid ${T.hairline}`,
        boxShadow: '0 24px 60px rgba(25,25,26,0.15)', width: '100%', maxWidth: 560,
        maxHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', animation: 'fadeUp 0.15s ease-out',
      }}>
        <div style={{ padding: '20px 24px 12px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: T.ink, letterSpacing: '-0.01em' }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: T.ink60, lineHeight: 1.5 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label={t('common.close')} style={{ fontSize: 16, color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>✕</button>
        </div>
        <div style={{ padding: '4px 24px 16px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '12px 24px 18px', borderTop: `1px solid ${T.hairlineSoft}`, display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>{footer}</div>}
      </div>
    </div>
  );
}

const btn = (T, primary) => ({
  padding: primary ? '8px 16px' : '5px 10px', fontSize: primary ? 13 : 12, fontFamily: T.fontUI, borderRadius: T.r6, cursor: 'pointer',
  fontWeight: primary ? 500 : 400,
  ...(primary ? { background: T.ink, color: T.paper, border: 'none' } : { background: 'transparent', color: T.ink60, border: `1px solid ${T.hairline}` }),
});

// One task, and where it can go. `choices`: ids of lib/rituels.js's moveTo.
const CHOICE_KEY = { today: 'ritual.today', tomorrow: 'ritual.tomorrow', later: 'ritual.later', someday: 'ritual.someday' };
function Row({ task, meta, choices, onChoose, T }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  return (
    <div data-ritual-task={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${T.hairlineSoft}`, opacity: busy ? 0.5 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
        {meta && <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, marginTop: 2 }}>{meta}</div>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {choices.map(c => (
          <button key={c} type="button" data-choice={c} disabled={busy}
            onClick={async () => { setBusy(true); try { await onChoose(task, c); } finally { setBusy(false); } }}
            style={btn(T, false)}>{t(CHOICE_KEY[c])}</button>
        ))}
      </div>
    </div>
  );
}

function Empty({ children, T }) {
  return <div style={{ padding: '14px 0', fontSize: 13, color: T.ink40 }}>{children}</div>;
}

// ── Plan my day ──────────────────────────────────────────────────────────────
// Three steps, the empty ones skipped (planSteps): what is left from before,
// what today holds and whether it fits, and once a month « Someday ».
export function MorningPlan({ tasks, onClose, onChanged }) {
  const { T } = useTheme();
  const { t, fmtDate, fmtDuration, fmtHours } = useLocale();
  const now = new Date();
  const estimation = useEstimation();
  const workday = useWorkday();
  const [steps] = useState(() => planSteps({ tasks, now, lastReview: readMark(RITUAL_KEYS.review) }));
  const [i, setI] = useState(0);
  const step = steps[i];
  const mins = (m) => (m >= 60 ? fmtHours(m) : fmtDuration(m));

  const choose = async (task, c) => { await put(task.id, moveTo(c, new Date())); await onChanged?.(); };
  const finish = () => {
    writeMark(RITUAL_KEYS.planned, dayOf(new Date()));
    if (steps.includes('someday')) writeMark(RITUAL_KEYS.review, new Date().toISOString());
    onClose();
  };

  const left = leftovers(tasks, now);
  const today = todayTasks(tasks, now);
  const fit = capacity({ tasks: today, now, workday, estimation });
  const pool = candidatesForToday(tasks).slice(0, 8);
  const someday = tasks.filter(x => x.someday && x.status !== 'done' && !x.archived);

  const titles = { leftovers: t('ritual.plan.leftoversTitle'), today: t('ritual.plan.todayTitle'), someday: t('ritual.plan.somedayTitle') };
  const last = i === steps.length - 1;
  return (
    <Shell testId="plan" onClose={onClose}
      title={t('ritual.plan.title')}
      subtitle={`${t('ritual.stepOf', { n: i + 1, total: steps.length })} · ${titles[step]}`}
      footer={<>
        {i > 0 && <button type="button" onClick={() => setI(i - 1)} style={btn(T, false)}>{t('ritual.back')}</button>}
        {last
          ? <button type="button" data-act="finish" onClick={finish} style={btn(T, true)}>{t('ritual.plan.done')}</button>
          : <button type="button" data-act="next" onClick={() => setI(i + 1)} style={btn(T, true)}>{t('ritual.next')}</button>}
      </>}>
      {step === 'leftovers' && (<>
        <p style={{ fontSize: 13, color: T.ink60, margin: '0 0 6px' }}>{t('ritual.plan.leftoversBody')}</p>
        {left.length ? left.map(task => (
          <Row key={task.id} task={task} T={T} meta={fmtDate(new Date(task.deadline + 'T00:00:00'), { day: 'numeric', month: 'short' })}
            choices={['today', 'tomorrow', 'later', 'someday']} onChoose={choose} />
        )) : <Empty T={T}>{t('ritual.plan.leftoversNone')}</Empty>}
      </>)}

      {step === 'today' && (<>
        {fit.free != null && (
          <div data-capacity={fit.over ? 'over' : 'fits'} style={{
            padding: '10px 12px', borderRadius: T.r6, marginBottom: 8, fontSize: 13, lineHeight: 1.5,
            background: fit.over ? T.dangerSoft : T.paperSubtle, color: fit.over ? T.danger : T.ink80,
            border: `1px solid ${fit.over ? T.dangerBorder : T.hairline}`,
          }}>
            {fit.over
              ? t('ritual.plan.over', { planned: mins(fit.planned), free: mins(fit.free), extra: mins(fit.planned - fit.free) })
              : t('ritual.plan.fits', { planned: mins(fit.planned), free: mins(fit.free) })}
          </div>
        )}
        {today.length ? today.map(task => (
          <Row key={task.id} task={task} T={T}
            meta={task.quick ? (task.time || t('ritual.quick')) : [task.time, task.estimatedDuration ? mins(task.estimatedDuration) : null].filter(Boolean).join(' · ')}
            choices={['tomorrow', 'later', 'someday']} onChoose={choose} />
        )) : <Empty T={T}>{t('ritual.plan.todayNone')}</Empty>}
        {pool.length > 0 && (<>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, margin: '18px 0 2px' }}>{t('ritual.plan.pull')}</div>
          {pool.map(task => <Row key={task.id} task={task} T={T} choices={['today', 'someday']} onChoose={choose} />)}
        </>)}
      </>)}

      {step === 'someday' && (<>
        <p style={{ fontSize: 13, color: T.ink60, margin: '0 0 6px' }}>{t('ritual.plan.somedayBody')}</p>
        {someday.length ? someday.map(task => (
          <Row key={task.id} task={task} T={T} choices={['today', 'later']} onChoose={choose} />
        )) : <Empty T={T}>{t('ritual.plan.somedayNone')}</Empty>}
      </>)}
    </Shell>
  );
}

// ── Shut down ────────────────────────────────────────────────────────────────
// What got done, then a place for what did not: nothing stays « today » by
// default, so tomorrow starts from a decision, not a pile.
export function Shutdown({ tasks, onClose, onChanged }) {
  const { T } = useTheme();
  const { t } = useLocale();
  const now = new Date();
  const done = doneOn(tasks, now);
  const open = todayTasks(tasks, now);
  const choose = async (task, c) => { await put(task.id, moveTo(c, new Date())); await onChanged?.(); };
  const finish = () => { writeMark(RITUAL_KEYS.shutdown, dayOf(new Date())); onClose(); };
  return (
    <Shell testId="shutdown" onClose={onClose} title={t('ritual.shutdown.title')}
      subtitle={t(done.length === 1 ? 'ritual.shutdown.doneOne' : 'ritual.shutdown.done', { n: done.length })}
      footer={<button type="button" data-act="finish" onClick={finish} style={btn(T, true)}>{t('ritual.shutdown.finish')}</button>}>
      {done.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {done.map(task => (
            <div key={task.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 13, color: T.ink60 }}>
              <span style={{ color: T.done }}>✓</span><span style={{ textDecoration: 'line-through' }}>{task.title}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, margin: '4px 0 2px' }}>{t('ritual.shutdown.leftTitle')}</div>
      {open.length ? open.map(task => (
        <Row key={task.id} task={task} T={T} choices={['tomorrow', 'later', 'someday']} onChoose={choose} />
      )) : <Empty T={T}>{t('ritual.shutdown.allDone')}</Empty>}
    </Shell>
  );
}

// ── Empty your head ──────────────────────────────────────────────────────────
// Type everything, one per line, without deciding anything; then sort. A line
// that carries its own day keeps it (« dentiste vendredi 9h »).
export function BrainDump({ onClose, onChanged }) {
  const { T } = useTheme();
  const { t, locale } = useLocale();
  const [text, setText] = useState('');
  const [items, setItems] = useState(null);   // null: still typing
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sort = () => setItems(parseDump(text, new Date(), { dateOrder: dateOrderFor(locale) }));
  const setChoice = (k, c) => setItems(list => list.map((x, j) => (j === k ? { ...x, choice: c } : x)));
  const kept = (items || []).filter(x => x.choice !== 'drop');

  async function create() {
    setSaving(true); setError('');
    try {
      const now = new Date();
      for (const x of kept) {
        const where = x.choice === 'dated' ? {} : moveTo(x.choice, now);
        const body = { title: x.title, tags: x.tags, deadline: x.deadline, time: x.time, estimatedDuration: x.estimatedDuration, recurring: x.recurring, priority: x.priority, ...where };
        const r = await fetch(`${API}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(String(r.status));
      }
      await onChanged?.(kept.length);
      onClose();
    } catch { setError(t('ritual.dump.failed')); }
    finally { setSaving(false); }
  }

  const choices = (x) => [...(x.deadline ? ['dated'] : []), 'today', 'later', 'someday', 'drop'];
  const label = (c, x) => (c === 'dated' ? x.deadline : t(c === 'drop' ? 'ritual.dump.drop' : CHOICE_KEY[c]));
  return (
    <Shell testId="dump" onClose={onClose} title={t('ritual.dump.title')}
      subtitle={items ? t('ritual.dump.sortBody') : t('ritual.dump.typeBody')}
      footer={items ? <>
        <button type="button" onClick={() => setItems(null)} style={btn(T, false)}>{t('ritual.back')}</button>
        <button type="button" data-act="create" disabled={saving || !kept.length} onClick={create} style={btn(T, true)}>
          {t(kept.length === 1 ? 'ritual.dump.createOne' : 'ritual.dump.create', { n: kept.length })}
        </button>
      </> : <button type="button" data-act="sort" disabled={!text.trim()} onClick={sort} style={btn(T, true)}>{t('ritual.dump.sort')}</button>}>
      {!items ? (
        <textarea autoFocus data-field="dump" aria-label={t('ritual.dump.title')} value={text} onChange={e => setText(e.target.value)}
          placeholder={t('ritual.dump.placeholder')} rows={12}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14, lineHeight: 1.6, fontFamily: T.fontUI, color: T.ink, background: T.paperSubtle, border: `1px solid ${T.hairline}`, borderRadius: T.r10, outline: 'none', resize: 'vertical' }} />
      ) : items.length === 0 ? <Empty T={T}>{t('ritual.dump.nothing')}</Empty> : items.map((x, k) => (
        <div key={k} data-dump-line={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${T.hairlineSoft}`, opacity: x.choice === 'drop' ? 0.45 : 1 }}>
          <span style={{ flex: 1, fontSize: 13.5, color: T.ink, textDecoration: x.choice === 'drop' ? 'line-through' : 'none' }}>
            {x.title}{x.time ? <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}> · {x.time}</span> : null}
          </span>
          <div role="radiogroup" aria-label={x.title} style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {choices(x).map(c => (
              <button key={c} type="button" role="radio" aria-checked={x.choice === c} data-choice={c} onClick={() => setChoice(k, c)} style={{
                ...btn(T, false), padding: '4px 8px', fontSize: 11.5,
                ...(x.choice === c ? { background: T.ink, color: T.paper, borderColor: T.ink } : {}),
              }}>{label(c, x)}</button>
            ))}
          </div>
        </div>
      ))}
      {error && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: T.danger }}>{error}</div>}
    </Shell>
  );
}

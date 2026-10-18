import { useMemo, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { LEVEL_STYLE, LEVEL_IDS } from '../lib/niveaux.js';

// The detail panel's priority, difficulty and links (1.8.0). Each change is
// one PUT of one field, then onSaved (refresh) and onEdited (the « Undo »).
const API = 'http://localhost:3001/api';

async function put(id, body) {
  const r = await fetch(`${API}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || String(r.status)); }
}

const label = (T) => ({ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 });
const pill = (T, on, color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: T.rPill,
  fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
  background: on ? T.paper : 'transparent', color: on ? T.ink : T.ink60,
  border: `1px solid ${on ? (color || T.ink) : T.hairline}`,
});

export function PriorityRow({ task, T, onSaved, onEdited }) {
  const { t } = useLocale();
  const set = async (priority) => {
    if (priority === (task.priority ?? null)) return;
    try { await put(task.id, { priority }); onSaved?.(); onEdited?.(task, { priority }); } catch {}
  };
  return (
    <div data-tour="detail-priority">
      <div style={label(T)}>{t('detail.priority')}</div>
      <div role="radiogroup" aria-label={t('detail.priority')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LEVEL_IDS.map(id => (
          <button key={id} type="button" role="radio" aria-checked={task.priority === id} data-level={id}
            onClick={() => set(id)} style={pill(T, task.priority === id, LEVEL_STYLE[id].color)}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: LEVEL_STYLE[id].color }} />
            {t(LEVEL_STYLE[id].key)}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={!task.priority} onClick={() => set(null)} style={pill(T, !task.priority)}>
          {t('level.ai')}
        </button>
      </div>
    </div>
  );
}

export function DifficultyRow({ task, T, onSaved, onEdited }) {
  const { t } = useLocale();
  const set = async (difficulty) => {
    const next = difficulty === task.difficulty ? null : difficulty;   // a second click clears it
    try { await put(task.id, { difficulty: next }); onSaved?.(); onEdited?.(task, { difficulty: next }); } catch {}
  };
  return (
    <div>
      <div style={label(T)}>{t('detail.difficulty')}</div>
      <div role="radiogroup" aria-label={t('detail.difficulty')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={task.difficulty === n} title={t(`difficulty.${n}`)}
            onClick={() => set(n)} style={{
              width: 26, height: 26, borderRadius: 6, cursor: 'pointer', fontFamily: T.fontMono, fontSize: 12,
              background: task.difficulty >= n ? T.ink : T.paperSubtle, color: task.difficulty >= n ? T.paper : T.ink60,
              border: `1px solid ${T.hairline}`,
            }}>{n}</button>
        ))}
        <span style={{ fontSize: 12, color: T.ink60, marginLeft: 6 }}>
          {task.difficulty ? t(`difficulty.${task.difficulty}`) : t('difficulty.unknown')}
        </span>
      </div>
    </div>
  );
}

// Bloquée par / Bloque / Liée à, each removable; « + Add a link ». A link
// lives on the task it starts from, so removing « blocked by X » edits X.
export function LinksSection({ task, allTasks, T, onSaved }) {
  const { t } = useLocale();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState('blocks');       // 'blocks' | 'blockedBy' | 'related'
  const [strength, setStrength] = useState('hard');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const byId = useMemo(() => new Map(allTasks.map(x => [x.id, x])), [allTasks]);
  const own = task.links || [];
  const incoming = allTasks.flatMap(x => (x.links || []).filter(l => l.to === task.id).map(l => ({ ...l, from: x.id })));
  const rows = [
    ...incoming.filter(l => l.type === 'blocks').map(l => ({ key: `in-${l.from}`, other: l.from, label: l.strength === 'soft' ? 'links.rowBetterAfter' : 'links.rowBlockedBy', owner: l.from, to: task.id, type: 'blocks' })),
    ...own.filter(l => l.type === 'blocks').map(l => ({ key: `out-${l.to}`, other: l.to, label: l.strength === 'soft' ? 'links.rowBetterBefore' : 'links.rowBlocks', owner: task.id, to: l.to, type: 'blocks' })),
    ...own.filter(l => l.type === 'related').map(l => ({ key: `rel-${l.to}`, other: l.to, label: 'links.rowRelated', owner: task.id, to: l.to, type: 'related' })),
    ...incoming.filter(l => l.type === 'related').map(l => ({ key: `relin-${l.from}`, other: l.from, label: 'links.rowRelated', owner: l.from, to: task.id, type: 'related' })),
  ].filter(r => byId.has(r.other));

  async function remove(r) {
    const owner = byId.get(r.owner);
    try { await put(owner.id, { links: (owner.links || []).filter(l => !(l.to === r.to && l.type === r.type)) }); onSaved?.(); } catch {}
  }
  async function add(other) {
    setError('');
    const [ownerId, to] = kind === 'blockedBy' ? [other.id, task.id] : [task.id, other.id];
    const owner = byId.get(ownerId);
    const type = kind === 'related' ? 'related' : 'blocks';
    const link = { to, type, ...(type === 'blocks' ? { strength } : {}) };
    try {
      await put(ownerId, { links: [...(owner.links || []).filter(l => !(l.to === to && l.type === type)), link] });
      onSaved?.(); setAdding(false); setQuery('');
    } catch (e) {
      setError(/loop/i.test(e.message) ? t('links.loop') : t('links.saveFailed'));
    }
  }

  const linked = new Set(rows.map(r => r.other));
  const candidates = allTasks
    .filter(x => x.id !== task.id && !x.archived && x.status !== 'done' && !linked.has(x.id))
    .filter(x => !query.trim() || x.title.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 6);

  return (
    <div data-tour="detail-links">
      <div style={label(T)}>{t('links.title')}</div>
      {rows.length === 0 && !adding && <div style={{ fontSize: 12.5, color: T.ink40, marginBottom: 6 }}>{t('links.none')}</div>}
      {rows.map(r => (
        <div key={r.key} data-link-row={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5 }}>
          <span style={{ color: T.ink60, minWidth: 110 }}>{t(r.label)}</span>
          <span style={{ color: T.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{byId.get(r.other).title}</span>
          <button type="button" onClick={() => remove(r)} aria-label={t('links.remove')} title={t('links.remove')}
            style={{ background: 'transparent', border: 'none', color: T.ink40, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>×</button>
        </div>
      ))}
      {adding ? (
        <div style={{ marginTop: 8, padding: 10, border: `1px solid ${T.hairline}`, borderRadius: T.r6, background: T.paperSubtle, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div role="radiogroup" aria-label={t('links.kind')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[['blocks', 'links.kindBlocks'], ['blockedBy', 'links.kindBlockedBy'], ['related', 'links.kindRelated']].map(([k, key]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} style={pill(T, kind === k)}>{t(key)}</button>
            ))}
          </div>
          {kind !== 'related' && (
            <div role="radiogroup" aria-label={t('links.strength')} style={{ display: 'flex', gap: 6 }}>
              <button type="button" role="radio" aria-checked={strength === 'hard'} onClick={() => setStrength('hard')} style={pill(T, strength === 'hard')}>{t('links.hard')}</button>
              <button type="button" role="radio" aria-checked={strength === 'soft'} onClick={() => setStrength('soft')} style={pill(T, strength === 'soft')}>{t('links.soft')}</button>
            </div>
          )}
          <input aria-label={t('links.search')} autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={t('links.search')}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); } if (e.key === 'Enter' && candidates[0]) add(candidates[0]); }}
            style={{ padding: '6px 8px', fontSize: 12.5, fontFamily: T.fontUI, background: T.paper, color: T.ink, border: `1px solid ${T.hairline}`, borderRadius: T.r6, outline: 'none' }} />
          {candidates.map(c => (
            <button key={c.id} type="button" data-link-candidate onClick={() => add(c)} style={{ textAlign: 'left', padding: '5px 8px', fontSize: 12.5, background: 'transparent', border: 'none', color: T.ink80, cursor: 'pointer', borderRadius: 4, fontFamily: T.fontUI }}>{c.title}</button>
          ))}
          {error && <div role="alert" style={{ fontSize: 12, color: T.danger || T.warn }}>{error}</div>}
        </div>
      ) : (
        <button type="button" data-add-link onClick={() => { setAdding(true); setError(''); }} style={{ marginTop: 4, fontSize: 12, color: T.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: T.fontUI }}>
          {t('links.add')}
        </button>
      )}
    </div>
  );
}

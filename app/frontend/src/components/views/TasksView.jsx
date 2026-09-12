import { useState, useMemo, useEffect } from 'react';
import TaskCard from '../TaskCard.jsx';
import { tagColor } from '../TaskForm.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';

const STATUSES = ['', 'not_started', 'in_progress', 'done'];
// Keys, resolved at render time so the filter relabels when the language changes.
const STATUS_KEYS = { '': 'status.all', not_started: 'status.notStarted', in_progress: 'status.inProgress', done: 'status.done' };

export default function TasksView({ rankedTasks, analyzing, onAddTask, activeArea, onClearArea, ...handlers }) {
  const { T } = useTheme();
  const { t } = useLocale();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tagFilter, setTagFilter]   = useState(activeArea || '');
  const [hideDone, setHideDone]     = useState(true);

  useEffect(() => { setTagFilter(activeArea || ''); }, [activeArea]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const allTags = useMemo(() => {
    const set = new Set();
    rankedTasks.forEach(t => t.tags?.forEach(tag => set.add(tag)));
    return [...set].sort();
  }, [rankedTasks]);

  const filtered = useMemo(() => {
    return rankedTasks.filter(task => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        task.title.toLowerCase().includes(q) ||
        (task.description || '').toLowerCase().includes(q) ||
        (task.tags || []).some(t => t.toLowerCase().includes(q));
      const matchStatus = !statusFilter || task.status === statusFilter;
      const matchTag    = !tagFilter    || task.tags?.includes(tagFilter);
      const matchDone   = !hideDone || statusFilter === 'done' || task.status !== 'done';
      return matchSearch && matchStatus && matchTag && matchDone;
    });
  }, [rankedTasks, search, statusFilter, tagFilter, hideDone]);

  function clearFilters() { setSearchInput(''); setSearch(''); setStatusFilter(''); setTagFilter(''); onClearArea?.(); }
  const hasFilters = search || statusFilter || tagFilter;

  const pill = (active) => ({
    fontSize: 12, padding: '5px 12px', borderRadius: T.rPill,
    background: active ? T.ink : T.paperSubtle,
    color: active ? T.paper : T.ink60,
    border: `1px solid ${active ? T.ink : T.hairline}`,
    cursor: 'pointer', fontFamily: T.fontUI,
    transition: 'all 0.1s',
  });

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: '36px 56px',
      fontFamily: T.fontUI,
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>
            {t('tasks.allTasks')}
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: T.ink }}>
            {t('tasks.count', { n: rankedTasks.length })}
            {analyzing && <span style={{ fontSize: 14, color: T.accent, marginLeft: 12, fontWeight: 400 }}>· analyzing…</span>}
          </h1>
        </div>
        <button onClick={onAddTask} style={{
          padding: '9px 18px', background: T.ink, border: 'none',
          borderRadius: T.r6, fontSize: 13.5, fontWeight: 500,
          color: T.paper, cursor: 'pointer', fontFamily: T.fontUI,
        }}>+ Add Task</button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.ink40 }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={searchInput} onChange={e => setSearchInput(e.target.value)}
          placeholder={t('tasks.searchPlaceholder')}
          style={{
            width: '100%', paddingLeft: 38, paddingRight: 14,
            paddingTop: 10, paddingBottom: 10,
            background: T.paperSubtle, border: `1px solid ${T.hairline}`,
            borderRadius: T.r6, fontSize: 13.5, color: T.ink,
            fontFamily: T.fontUI, outline: 'none',
          }}
        />
        {search && (
          <button onClick={() => { setSearchInput(''); setSearch(''); }} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14,
          }}>✕</button>
        )}
      </div>

      {/* Status filters + hide-done toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={pill(statusFilter === s)}>
              {t(STATUS_KEYS[s])}
            </button>
          ))}
        </div>
        <button
          onClick={() => setHideDone(h => !h)}
          style={{
            fontSize: 12, padding: '5px 12px', borderRadius: T.rPill,
            background: hideDone ? T.paperSubtle : T.ink,
            color: hideDone ? T.ink60 : T.paper,
            border: `1px solid ${hideDone ? T.hairline : T.ink}`,
            cursor: 'pointer', fontFamily: T.fontUI, flexShrink: 0,
          }}
        >
          {hideDone ? t('tasks.showCompleted') : t('tasks.hideCompleted')}
        </button>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {allTags.map(tag => {
            const c = tagColor(tag);
            const active = tagFilter === tag;
            return (
              <button key={tag} onClick={() => { const next = active ? '' : tag; setTagFilter(next); if (!next) onClearArea?.(); }} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11.5, padding: '4px 10px', borderRadius: T.rPill,
                background: active ? T.paperMuted : T.paperSubtle,
                color: T.ink60,
                border: `1px solid ${active ? T.divider : T.hairline}`,
                cursor: 'pointer', fontFamily: T.fontMono,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color }} />
                {tag}
              </button>
            );
          })}
        </div>
      )}

      {/* Task list */}
      {filtered.length > 0 ? (
        <div>
          {filtered.map(task => <TaskCard key={task.id} task={task} {...handlers} />)}
        </div>
      ) : rankedTasks.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 64, textAlign: 'center' }}>
          {/* Inbox tray illustration */}
          <svg width="96" height="80" viewBox="0 0 96 80" fill="none">
            <rect x="8" y="36" width="80" height="36" rx="6" fill={T.paperSubtle} stroke={T.hairline} strokeWidth="1.2" />
            <path d="M8 52h18l5 8h26l5-8h34" stroke={T.hairline} strokeWidth="1.2" />
            <circle cx="48" cy="26" r="11" fill={T.accentSoft} stroke={T.accent} strokeWidth="1.2" />
            <path d="M43.5 26.5l3 3 6-6" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: T.ink }}>{t('tasks.emptyTitle')}</h2>
          <p style={{ margin: 0, fontSize: 14.5, color: T.ink60, lineHeight: 1.6, maxWidth: 380 }}>
            {t('tasks.emptyBody')}
          </p>
          <button onClick={onAddTask} style={{
            fontFamily: T.fontUI, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            padding: '9px 16px', borderRadius: T.r6,
            background: T.ink, color: T.paper, border: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            {t('tasks.captureTask')}
            <span style={{ fontFamily: T.fontMono, fontSize: 10, opacity: 0.6, background: 'rgba(255,255,255,0.15)', padding: '2px 5px', borderRadius: 3 }}>Ctrl+K</span>
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', paddingTop: 48 }}>
          <p style={{ fontSize: 13.5, color: T.ink60, marginBottom: 16 }}>{t('tasks.noMatch')}</p>
          <button onClick={clearFilters} style={{
            fontSize: 13, color: T.accent, background: 'transparent', border: 'none',
            cursor: 'pointer', fontFamily: T.fontUI,
          }}>{t('tasks.clearFilters')}</button>
        </div>
      )}
    </div>
  );
}

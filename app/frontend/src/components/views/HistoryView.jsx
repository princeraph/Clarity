import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';

function relativeTime(iso, t) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('time.hoursAgo', { n: hrs });
  return t('time.daysAgo', { n: Math.floor(hrs / 24) });
}

// Takes the formatter rather than hard-coding en-US: a date is part of the
// interface language too, not a thing that stays American when the rest moves.
function dayKey(iso, t, fmtDate) {
  if (!iso) return t('time.unknown');
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (taskDay.getTime() === today.getTime()) return t('time.today').toUpperCase();
  if (taskDay.getTime() === yesterday.getTime()) return t('time.yesterday').toUpperCase();
  return fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}

function HistoryRow({ task, isArchived, onRestore, T }) {
  const { t } = useLocale();
  const [hov, setHov] = useState(false);
  const timestamp = isArchived ? task.archivedAt : task.updatedAt;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'grid', gridTemplateColumns: '20px 1fr auto',
        alignItems: 'center', gap: 14,
        padding: '10px 4px',
        borderBottom: `1px solid ${T.hairlineSoft}`,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        background: isArchived ? 'transparent' : T.done,
        border: `1.5px solid ${isArchived ? T.ink20 : T.done}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isArchived
          ? <span style={{ color: T.ink40, fontSize: 8, lineHeight: 1 }}>✕</span>
          : <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2"><polyline points="2 5 4.5 7.5 8 3"/></svg>
        }
      </div>

      <div style={{ minWidth: 0 }}>
        <span style={{
          fontSize: 14, color: isArchived ? T.ink40 : T.ink60,
          textDecoration: 'line-through',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'block',
        }}>{task.title}</span>
        {task.tags?.length > 0 && (
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>
            {task.tags.join(', ')}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40, whiteSpace: 'nowrap' }}>
          {isArchived ? t('history.archived') : t('history.completed')} {relativeTime(timestamp, t)}
        </span>
        {hov && onRestore && (
          <button
            onClick={() => onRestore(task.id)}
            style={{
              fontSize: 12, fontWeight: 500, color: T.done,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: T.fontUI, padding: 0, whiteSpace: 'nowrap',
            }}
          >{t('archive.restore')}</button>
        )}
      </div>
    </div>
  );
}

export default function HistoryView({ tasks, archivedTasks, onRestore }) {
  const { T } = useTheme();
  const { t, fmtDate } = useLocale();
  const [tab, setTab] = useState('completed');
  const [search, setSearch] = useState('');

  const completed = useMemo(() =>
    (tasks || [])
      .filter(t => t.status === 'done')
      .sort((a, b) => {
        const doneAt = t => {
          const entry = [...(t.history || [])].reverse().find(h => h.type === 'status' && h.to === 'done');
          return entry ? entry.at : t.updatedAt;
        };
        return new Date(doneAt(b)) - new Date(doneAt(a));
      }),
    [tasks]
  );

  const archived = useMemo(() =>
    (archivedTasks || [])
      .sort((a, b) => new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0)),
    [archivedTasks]
  );

  const items = tab === 'completed' ? completed : archived;
  const isArchived = tab === 'archived';

  const filtered = search
    ? items.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  const groups = useMemo(() => {
    const map = new Map();
    for (const task of filtered) {
      const key = dayKey(isArchived ? task.archivedAt : task.updatedAt, t, fmtDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    }
    return [...map.entries()];
  }, [filtered, isArchived]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '36px 56px', fontFamily: T.fontUI, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>
          {tab === 'completed' ? t('history.countCompleted', { n: completed.length }) : t('history.countArchived', { n: archived.length })}
        </div>
        <h1 style={{ margin: 0, fontSize: 38, fontWeight: 500, letterSpacing: '-0.035em', color: T.ink }}>{t('history.title')}</h1>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.ink40} strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('history.searchPlaceholder')}
            style={{
              width: '100%', padding: '8px 12px 8px 32px',
              background: T.paperSubtle, border: `1px solid ${T.hairline}`,
              borderRadius: T.r6, fontSize: 13, color: T.ink,
              fontFamily: T.fontUI, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4, background: T.paperSubtle, padding: 3, borderRadius: T.rPill, border: `1px solid ${T.hairline}` }}>
          {[['completed', t('history.completed')], ['archived', t('history.archived')]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '5px 14px', borderRadius: T.rPill, border: 'none', cursor: 'pointer',
              fontFamily: T.fontUI, fontSize: 12.5, fontWeight: tab === id ? 500 : 400,
              background: tab === id ? T.ink : 'transparent',
              color: tab === id ? T.paper : T.ink60,
              transition: 'background 0.1s, color 0.1s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 64 }}>
          <div style={{ width: 52, height: 52, borderRadius: T.r10, background: T.paperSubtle, border: `1px solid ${T.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.ink40} strokeWidth="1.6">
              <circle cx="12" cy="12" r="9"/><polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 500, color: T.ink60, margin: 0 }}>{t('history.emptyTitle')}</p>
          <p style={{ fontSize: 13, color: T.ink40, marginTop: 6 }}>
            {tab === 'completed' ? t('history.emptyCompleted') : t('history.emptyArchived')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 48 }}>
          {groups.map(([dateLabel, groupTasks]) => (
            <div key={dateLabel}>
              <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 10 }}>
                {dateLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {groupTasks.map(task => (
                  <HistoryRow key={task.id} task={task} isArchived={isArchived} onRestore={onRestore} T={T} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

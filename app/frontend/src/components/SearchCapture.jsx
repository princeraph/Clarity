import { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';

const API = 'http://localhost:3001/api';

function parseInput(text) {
  const tagSet = new Set();
  let deadline = null;
  let estimatedDuration = null;
  let title = text;

  title = title.replace(/#([\w-]+)/g, (_, t) => { tagSet.add(t.toLowerCase()); return ''; }).trim();
  const tags = [...tagSet];

  title = title.replace(
    /(?:for\s+|~)(\d+(?:\.\d+)?)\s*(h(?:ours?)?|min(?:utes?)?|m)\b/gi,
    (_, n, unit) => {
      const num = parseFloat(n);
      estimatedDuration = unit.toLowerCase().startsWith('h') ? Math.round(num * 60) : Math.round(num);
      return '';
    }
  ).trim().replace(/\s{2,}/g, ' ');

  const today = new Date();
  const fmt = d => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  };
  const nextWeekday = n => {
    const d = new Date(today);
    const diff = ((n - today.getDay() + 7) % 7) || 7;
    d.setDate(d.getDate() + diff);
    return fmt(d);
  };
  const todayFmt = fmt(today);
  const tomorrowFmt = (() => { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d); })();
  const DATE_WORDS = {
    today: todayFmt, tonight: todayFmt, tomorrow: tomorrowFmt,
    monday: nextWeekday(1), tuesday: nextWeekday(2), wednesday: nextWeekday(3),
    thursday: nextWeekday(4), friday: nextWeekday(5), saturday: nextWeekday(6), sunday: nextWeekday(0),
    mon: nextWeekday(1), tue: nextWeekday(2), wed: nextWeekday(3),
    thu: nextWeekday(4), fri: nextWeekday(5), sat: nextWeekday(6), sun: nextWeekday(0),
  };
  title = title.replace(
    /\b(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi,
    (_, w) => { if (!deadline) deadline = DATE_WORDS[w.toLowerCase()]; return ''; }
  ).trim().replace(/\s{2,}/g, ' ');

  return { title: title.trim(), tags, deadline, estimatedDuration };
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDuration(mins) {
  return mins >= 60 ? `${Math.round(mins / 60 * 10) / 10}h` : `${mins}m`;
}

function getTaskDueLabel(task) {
  if (!task.deadline) return null;
  const today = new Date();
  const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const ty = tomorrow.getFullYear(), tm = String(tomorrow.getMonth() + 1).padStart(2, '0'), td = String(tomorrow.getDate()).padStart(2, '0');
  const tomorrowStr = `${ty}-${tm}-${td}`;
  if (task.deadline < todayStr) return 'Overdue';
  if (task.deadline === todayStr) return 'Today';
  if (task.deadline === tomorrowStr) return 'Tomorrow';
  return new Date(task.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ParsePill({ label, value, T }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 9px',
      background: T.paper, border: `1px solid ${T.hairline}`,
      borderRadius: T.rPill, fontSize: 12, color: T.ink,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink40 }}>{label}</span>
      <span>{value}</span>
    </span>
  );
}

function SectionLabel({ label, T }) {
  return (
    <div style={{
      padding: '8px 18px 4px',
      fontFamily: T.fontMono, fontSize: 9.5,
      letterSpacing: '0.10em', textTransform: 'uppercase',
      color: T.ink40,
    }}>{label}</div>
  );
}

function CKDivider({ T }) {
  return <div style={{ height: 1, background: T.hairlineSoft, margin: '4px 0' }} />;
}

function CKFooter({ T, left, right }) {
  return (
    <div style={{
      padding: '10px 18px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderTop: `1px solid ${T.hairlineSoft}`,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>{left}</span>
      <div style={{ display: 'flex', gap: 14, fontFamily: T.fontMono, fontSize: 10.5, color: T.ink60 }}>
        {right.map((r, i) => (
          <span key={i}>
            <span style={{ padding: '1px 5px', background: T.paperMuted, borderRadius: 3, border: `1px solid ${T.hairline}`, marginRight: 4 }}>{r.key}</span>
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, active, showScore, onClick, T }) {
  const due = getTaskDueLabel(task);
  const area = task.tags?.[0] || '';
  const isOverdue = due === 'Overdue';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 18px',
        background: active ? T.paperSubtle : 'transparent',
        borderLeft: active ? `2px solid ${T.ink}` : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 13, height: 13, borderRadius: '50%',
        border: `1.5px solid ${T.ink40}`,
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 13.5, color: T.ink, flex: 1,
        fontWeight: active ? 500 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{task.title}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {showScore && (
          <span style={{ fontFamily: T.fontMono, fontSize: 9.5, color: T.accentInk, background: T.accentSoft, padding: '2px 6px', borderRadius: 3 }}>
            {showScore}
          </span>
        )}
        {area && <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, whiteSpace: 'nowrap' }}>{area}</span>}
        {due && <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: isOverdue ? T.danger : T.ink40 }}>{due}</span>}
      </div>
    </div>
  );
}

function CommandRow({ icon, label, kbd, active, onClick, T }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 18px',
        background: active ? T.paperSubtle : 'transparent',
        borderLeft: active ? `2px solid ${T.ink}` : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      <span style={{ width: 13, textAlign: 'center', fontSize: 12, color: T.ink40 }}>{icon}</span>
      <span style={{ fontSize: 13, color: T.ink60, flex: 1 }}>{label}</span>
      <span style={{
        fontFamily: T.fontMono, fontSize: 10, color: T.ink40,
        padding: '2px 6px', background: T.paperMuted, borderRadius: 3,
        border: `1px solid ${T.hairline}`,
      }}>{kbd}</span>
    </div>
  );
}

export default function SearchCapture({
  allTasks = [], onClose, onSaved, onSavedAndOpen, onOpenTask, onNavigate, onOpenChat,
}) {
  const { T } = useTheme();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('search'); // 'search' | 'capture'
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const recentTasks = useMemo(() =>
    allTasks.filter(t => !t.archived && t.status !== 'done').slice(0, 4),
    [allTasks]
  );

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allTasks
      .filter(t => !t.archived && t.title.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query, allTasks]);

  const commands = useMemo(() => [
    { icon: '◷', label: 'Go to Today',      kbd: 'Ctrl+1', action: () => { onNavigate?.('focus');    onClose(); } },
    { icon: '✉', label: 'Go to Inbox',      kbd: 'Ctrl+2', action: () => { onNavigate?.('tasks');    onClose(); } },
    { icon: '↗', label: 'Open Ask Clarity', kbd: 'Ctrl+/', action: () => { onOpenChat?.();           onClose(); } },
    { icon: '⚙', label: 'Open Settings',    kbd: 'Ctrl+,', action: () => { onNavigate?.('settings'); onClose(); } },
  ], [onNavigate, onOpenChat, onClose]);

  // Flat list of navigable items for keyboard selection
  const navItems = useMemo(() => {
    if (mode === 'capture') return [];
    if (!query.trim()) {
      return [
        ...recentTasks.map(t => ({ type: 'task', item: t })),
        ...commands.map(c => ({ type: 'command', item: c })),
      ];
    }
    return [
      ...searchResults.map(t => ({ type: 'task', item: t })),
      { type: 'capture' },
    ];
  }, [mode, query, recentTasks, searchResults, commands]);

  const parsed = mode === 'capture' ? parseInput(query) : null;

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (mode === 'capture') { setMode('search'); e.stopPropagation(); return; }
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      setMode('capture');
      return;
    }
    if (mode === 'capture') {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSave(true); }
      else if (e.key === 'Enter') { e.preventDefault(); handleSave(false); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (navItems.length > 0) setSelectedIndex(i => Math.min(i + 1, navItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const nav = navItems[selectedIndex];
      if (!nav) return;
      if (nav.type === 'task') { onOpenTask?.(nav.item); onClose(); }
      else if (nav.type === 'command') { nav.item.action?.(); }
      else if (nav.type === 'capture') { setMode('capture'); }
    }
  }

  useEffect(() => { setSelectedIndex(0); }, [query]);

  async function handleSave(openAfter = false) {
    if (!parsed?.title?.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parsed.title, tags: parsed.tags,
          deadline: parsed.deadline || null,
          estimatedDuration: parsed.estimatedDuration || null,
          status: 'not_started', recurring: 'none',
        }),
      });
      if (!resp.ok) { let msg = 'Save failed'; try { msg = (await resp.json()).error || msg; } catch {} throw new Error(msg); }
      const newTask = await resp.json();
      onSaved?.();
      onClose();
      if (openAfter && onSavedAndOpen && newTask?.id) onSavedAndOpen(newTask);
    } catch (err) {
      setSaveError(err.message || 'Could not save task — check your connection');
      setSaving(false);
    }
  }

  const hasParseResult = parsed && (parsed.tags?.length > 0 || parsed.deadline || parsed.estimatedDuration);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,15,18,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 72,
        fontFamily: T.fontUI,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: 'min(600px, 88vw)',
        background: T.paper,
        border: `1px solid ${T.hairline}`,
        borderRadius: 14,
        boxShadow: '0 24px 60px -20px rgba(25,25,26,0.18), 0 2px 6px rgba(25,25,26,0.05)',
        overflow: 'hidden',
        animation: 'fadeUp 0.15s ease-out',
      }}>
        {/* Input bar */}
        <div style={{
          padding: '16px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: `1px solid ${T.hairlineSoft}`,
        }}>
          {mode === 'capture' ? (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, boxShadow: `0 0 0 4px ${T.accentSoft}`, flexShrink: 0 }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4.5" stroke={T.ink40} strokeWidth="1.2" />
              <path d="M9.5 9.5L12.5 12.5" stroke={T.ink40} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'capture' ? 'What needs doing?' : 'Search tasks or capture new…'}
            disabled={saving}
            style={{
              flex: 1, fontSize: 16, color: T.ink,
              letterSpacing: '-0.01em', background: 'transparent',
              border: 'none', outline: 'none', fontFamily: T.fontUI,
            }}
          />
          {mode === 'capture' && (
            <span style={{
              fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: T.accentInk,
              padding: '3px 7px', background: T.accentSoft, borderRadius: 3,
              border: `1px solid ${T.accent}`,
            }}>Capture</span>
          )}
        </div>

        {/* Body — capture mode */}
        {mode === 'capture' && (
          <>
            {hasParseResult && (
              <div style={{
                padding: '12px 18px',
                background: T.paperSubtle,
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, marginRight: 4 }}>Parsed</span>
                {parsed.tags.map(tag => <ParsePill key={tag} label="area" value={tag} T={T} />)}
                {parsed.deadline && <ParsePill label="due" value={fmtDate(parsed.deadline)} T={T} />}
                {parsed.estimatedDuration && <ParsePill label="est" value={fmtDuration(parsed.estimatedDuration)} T={T} />}
              </div>
            )}
            {saveError && (
              <div style={{
                padding: '8px 18px', background: T.dangerSoft, fontSize: 12, color: T.danger,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{saveError}</span>
                <button onClick={() => setSaveError('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.danger, fontSize: 13, padding: 0 }}>✕</button>
              </div>
            )}
            <CKFooter T={T} left="On-device parse" right={[
              { key: 'Ctrl+↵', label: 'save & open' },
              { key: '↵', label: 'save' },
              { key: 'Esc', label: 'back' },
            ]} />
          </>
        )}

        {/* Body — search mode, empty query: recent + commands */}
        {mode === 'search' && !query.trim() && (
          <>
            {recentTasks.length > 0 && (
              <>
                <SectionLabel label="Recent" T={T} />
                {recentTasks.map((task, i) => (
                  <TaskRow
                    key={task.id} task={task}
                    active={selectedIndex === i}
                    onClick={() => { onOpenTask?.(task); onClose(); }}
                    T={T}
                  />
                ))}
                <CKDivider T={T} />
              </>
            )}
            <SectionLabel label="Commands" T={T} />
            {commands.map((cmd, i) => (
              <CommandRow
                key={cmd.label} {...cmd}
                active={selectedIndex === recentTasks.length + i}
                onClick={cmd.action}
                T={T}
              />
            ))}
            <CKFooter T={T} left="↑↓ navigate" right={[
              { key: '↵', label: 'open' },
              { key: 'Tab', label: 'capture' },
              { key: 'Esc', label: 'close' },
            ]} />
          </>
        )}

        {/* Body — search mode, active query: search results + capture option */}
        {mode === 'search' && query.trim() && (
          <>
            {searchResults.length > 0 && (
              <>
                <SectionLabel label={`Tasks matching "${query}"`} T={T} />
                {searchResults.map((task, i) => (
                  <TaskRow
                    key={task.id} task={task}
                    active={selectedIndex === i}
                    showScore={i === 0 ? 'best match' : null}
                    onClick={() => { onOpenTask?.(task); onClose(); }}
                    T={T}
                  />
                ))}
                <CKDivider T={T} />
              </>
            )}
            <div
              onClick={() => setMode('capture')}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 18px',
                background: T.accentSoft,
                borderLeft: `2px solid ${T.accent}`,
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: T.accentInk, flex: 1 }}>
                Capture "<strong>{query}</strong>" as a new task
              </span>
              <span style={{
                fontFamily: T.fontMono, fontSize: 10, color: T.accentInk,
                padding: '2px 6px', background: T.paper, borderRadius: 3,
                border: `1px solid ${T.accent}`,
              }}>Tab</span>
            </div>
            <CKFooter T={T}
              left={searchResults.length ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}` : 'No results'}
              right={[{ key: '↵', label: 'open task' }, { key: 'Tab', label: 'capture' }, { key: 'Esc', label: 'close' }]}
            />
          </>
        )}
      </div>
    </div>
  );
}

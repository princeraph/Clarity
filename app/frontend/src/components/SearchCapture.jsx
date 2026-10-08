import { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { parseInput } from '../lib/saisie.js';
import { localDay } from './glance.js';

const REPEATS = [['none', 'form.oneTime'], ['daily', 'form.daily'], ['weekly', 'form.weekly'], ['monthly', 'form.monthly']];
import { useFeatures } from '../features.js';

const API = 'http://localhost:3001/api';


function getTaskDueLabel(task, t, fmt) {
  if (!task.deadline) return { label: null, overdue: false };
  const today = new Date();
  const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const ty = tomorrow.getFullYear(), tm = String(tomorrow.getMonth() + 1).padStart(2, '0'), td = String(tomorrow.getDate()).padStart(2, '0');
  const tomorrowStr = `${ty}-${tm}-${td}`;
  if (task.deadline < todayStr) return { label: t('capture.overdue'), overdue: true };
  if (task.deadline === todayStr) return { label: t('time.today'), overdue: false };
  if (task.deadline === tomorrowStr) return { label: t('time.tomorrow'), overdue: false };
  return { label: fmt(task.deadline + 'T00:00:00'), overdue: false };
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
  const { t, fmtDate } = useLocale();
  const { label: due, overdue: isOverdue } = getTaskDueLabel(task, t, fmtDate);
  const area = task.tags?.[0] || '';
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
  const { t } = useLocale();
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
  // Ce composant appelait t() dix-sept fois et fmtDate une fois sans jamais
  // avoir eu ce hook : Ctrl+K levait « t is not defined » à chaque ouverture.
  // Le contrôle des locales ne le voyait pas — il exigeait la parenthèse
  // fermante des paramètres sur la même ligne, et ceux-ci tiennent sur deux.
  const { t, fmtDate, fmtDuration, fmtHours } = useLocale();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('search'); // 'search' | 'capture'
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const recentTasks = useMemo(() =>
    allTasks.filter(tache => !tache.archived && tache.status !== 'done').slice(0, 4),
    [allTasks]
  );

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allTasks
      .filter(tache => !tache.archived && tache.title.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query, allTasks]);

  const commands = useMemo(() => [
    { icon: '◷', label: t('capture.goToday'),      kbd: 'Ctrl+1', action: () => { onNavigate?.('focus');    onClose(); } },
    { icon: '✉', label: t('capture.goInbox'),      kbd: 'Ctrl+2', action: () => { onNavigate?.('tasks');    onClose(); } },
    { icon: '↗', label: t('capture.openChat'), kbd: 'Ctrl+/', action: () => { onOpenChat?.();           onClose(); } },
    { icon: '⚙', label: t('capture.openSettings'),    kbd: 'Ctrl+,', action: () => { onNavigate?.('settings'); onClose(); } },
  ], [onNavigate, onOpenChat, onClose, t]);

  // Flat list of navigable items for keyboard selection
  const navItems = useMemo(() => {
    if (mode === 'capture') return [];
    if (!query.trim()) {
      return [
        ...recentTasks.map(tache => ({ type: 'task', item: tache })),
        ...commands.map(c => ({ type: 'command', item: c })),
      ];
    }
    return [
      ...searchResults.map(tache => ({ type: 'task', item: tache })),
      { type: 'capture' },
    ];
  }, [mode, query, recentTasks, searchResults, commands]);

  // Settings › Capture: what the line understands, and whether it shows it.
  const features = useFeatures();
  const parsed = mode === 'capture'
    ? parseInput(query, new Date(), { tags: features?.captureTags !== false, duration: features?.captureDuration !== false })
    : null;
  // Repeat, chosen with a click — not only by writing « tous les lundis ».
  // null: follow what the line says; a click overrides it.
  const [repeat, setRepeat] = useState(null);
  const recurring = repeat ?? parsed?.recurring ?? 'none';
  // A repeat counts from a deadline: without one, the first is due today.
  const deadline = parsed?.deadline || (recurring !== 'none' ? localDay(new Date()) : null);

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (mode === 'capture') { setMode('search'); setRepeat(null); e.stopPropagation(); return; }
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
          deadline,
          estimatedDuration: parsed.estimatedDuration || null,
          status: 'not_started', recurring,
        }),
      });
      // The server's own message is English plumbing ("Title is required"); the
      // person gets the interface's sentence, never a raw error string.
      if (!resp.ok) { const e = new Error(); e.shown = t('capture.saveFailed'); throw e; }
      // The answer is { task, analyzing }: reading it as the task itself left
      // "save & open" (Ctrl+Enter) without an id, and it never opened anything.
      const { task: newTask } = await resp.json();
      onSaved?.();
      onClose();
      if (openAfter && onSavedAndOpen && newTask?.id) onSavedAndOpen(newTask);
    } catch (err) {
      setSaveError(err.shown || t('capture.saveUnreachable'));
      setSaving(false);
    }
  }

  const hasParseResult = features?.capturePreview !== false
    && parsed && (parsed.tags?.length > 0 || deadline || parsed.estimatedDuration);

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
            placeholder={mode === 'capture' ? t('capture.placeholderCapture') : t('capture.placeholder')}
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
            }}>{t('capture.title')}</span>
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
                <span style={{ fontFamily: T.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, marginRight: 4 }}>{t('onboarding.parsed')}</span>
                {parsed.tags.map(tag => <ParsePill key={tag} label={t('capture.area')} value={tag} T={T} />)}
                {deadline && <ParsePill label={t('capture.due')} value={fmtDate(deadline + 'T00:00:00')} T={T} />}
                {parsed.estimatedDuration && <ParsePill label={t('capture.est')} value={parsed.estimatedDuration >= 60 ? fmtHours(parsed.estimatedDuration) : fmtDuration(parsed.estimatedDuration)} T={T} />}
              </div>
            )}
            <div role="radiogroup" aria-label={t('detail.recurrence')} style={{
              padding: '10px 18px', borderTop: `1px solid ${T.hairlineSoft}`,
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, marginRight: 6 }}>{t('detail.recurrence')}</span>
              {REPEATS.map(([value, key]) => {
                const on = recurring === value;
                return (
                  <button key={value} type="button" role="radio" aria-checked={on}
                    onMouseDown={e => e.preventDefault()}   // keep the typing in the line
                    onClick={() => { setRepeat(value); inputRef.current?.focus(); }}
                    style={{
                      padding: '4px 10px', borderRadius: T.rPill, fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
                      border: `1px solid ${on ? T.accent : T.hairline}`,
                      background: on ? T.accentSoft : 'transparent', color: on ? T.accentInk : T.ink60,
                    }}>{t(key)}</button>
                );
              })}
            </div>
            {saveError && (
              <div style={{
                padding: '8px 18px', background: T.dangerSoft, fontSize: 12, color: T.danger,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{saveError}</span>
                <button onClick={() => setSaveError('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.danger, fontSize: 13, padding: 0 }}>✕</button>
              </div>
            )}
            <CKFooter T={T} left={t('capture.onDeviceParse')} right={[
              { key: 'Ctrl+↵', label: t('capture.kbd.saveOpen') },
              { key: '↵', label: t('capture.kbd.save') },
              { key: t('kbd.esc'), label: t('capture.kbd.back') },
            ]} />
          </>
        )}

        {/* Body — search mode, empty query: recent + commands */}
        {mode === 'search' && !query.trim() && (
          <>
            {recentTasks.length > 0 && (
              <>
                <SectionLabel label={t('capture.recent')} T={T} />
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
            <SectionLabel label={t('capture.commands')} T={T} />
            {commands.map((cmd, i) => (
              <CommandRow
                key={cmd.label} {...cmd}
                active={selectedIndex === recentTasks.length + i}
                onClick={cmd.action}
                T={T}
              />
            ))}
            <CKFooter T={T} left={t('capture.kbd.navigate')} right={[
              { key: '↵', label: t('capture.kbd.open') },
              { key: 'Tab', label: t('capture.kbd.capture') },
              { key: t('kbd.esc'), label: t('capture.kbd.close') },
            ]} />
          </>
        )}

        {/* Body — search mode, active query: search results + capture option */}
        {mode === 'search' && query.trim() && (
          <>
            {searchResults.length > 0 && (
              <>
                <SectionLabel label={t('capture.matching', { query })} T={T} />
                {searchResults.map((task, i) => (
                  <TaskRow
                    key={task.id} task={task}
                    active={selectedIndex === i}
                    showScore={i === 0 ? t('capture.bestMatch') : null}
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
                {(() => {
                  // The query is bold, so the sentence is split on its placeholder:
                  // each language keeps its own word order around it.
                  const [avant, apres] = t('capture.asNewTask').split('{query}');
                  return <>{avant}<strong>{query}</strong>{apres}</>;
                })()}
              </span>
              <span style={{
                fontFamily: T.fontMono, fontSize: 10, color: T.accentInk,
                padding: '2px 6px', background: T.paper, borderRadius: 3,
                border: `1px solid ${T.accent}`,
              }}>Tab</span>
            </div>
            <CKFooter T={T}
              left={searchResults.length ? t('capture.nResults', { n: searchResults.length }) : t('capture.noResults')}
              right={[{ key: '↵', label: t('capture.kbd.openTask') }, { key: 'Tab', label: t('capture.kbd.capture') }, { key: t('kbd.esc'), label: t('capture.kbd.close') }]}
            />
          </>
        )}
      </div>
    </div>
  );
}

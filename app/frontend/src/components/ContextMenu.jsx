import { LEVEL_STYLE, LEVEL_IDS } from '../lib/niveaux.js';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';

export default function ContextMenu({ task, x, y, allTasks, onClose, onEdit, onArchive, onDelete, onStatusChange, onOpenDetail, onSaved, onFocusMode, onSchedule, onSomeday }) {
  async function setPriority(priority) {
    try {
      const r = await fetch(`http://localhost:3001/api/tasks/${task.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority }) });
      if (r.ok) onSaved?.();
    } catch {}
    onClose();
  }
  const { T } = useTheme();
  const { t } = useLocale();
  const ref = useRef(null);
  const [showMoveToArea, setShowMoveToArea] = useState(false);
  const [pos, setPos] = useState({ x, y });

  const areas = [...new Set((allTasks || []).flatMap(t => t.tags || []))].sort();

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      x: x + rect.width > vw ? Math.max(0, x - rect.width) : x,
      y: y + rect.height > vh ? Math.max(0, y - rect.height) : y,
    });
  }, [x, y]);

  const keyActions = useRef({});
  keyActions.current = {
    ' ':      () => onStatusChange(task, task.status === 'done' ? 'not_started' : 'done'),
    'Enter':  () => onOpenDetail?.(task),
    'Delete': () => onDelete(task.id),
  };
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }   // handled: the panel under it stays
      // The keys the menu shows next to its items: they used to do nothing.
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (tag === 'BUTTON' && ref.current?.contains(e.target)) || e.ctrlKey || e.metaKey || e.altKey) return;
      const act = keyActions.current[e.key];
      if (act) { e.preventDefault(); act(); onClose(); }
    }
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  async function moveToArea(tag) {
    const existing = task.tags || [];
    if (existing.includes(tag)) { onClose(); return; }
    const tags = [tag, ...existing];
    try {
      const resp = await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      if (!resp.ok) throw new Error();
      onSaved?.();
    } catch {}
    onClose();
  }

  const isDone = task.status === 'done';

  function MenuItem({ icon, label, kbd, danger, muted, onClick, hasArrow }) {
    const [hov, setHov] = useState(false);
    return (
      <button
        onClick={e => { e.stopPropagation(); onClick(); }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', height: 30, padding: '0 12px',
          color: danger ? T.danger : muted ? T.ink60 : T.ink,
          background: hov ? T.paperSubtle : 'transparent',
          border: 'none', cursor: 'pointer', fontFamily: T.fontUI,
          fontSize: 12.5, textAlign: 'left',
        }}
      >
        <span style={{ width: 16, textAlign: 'center', fontSize: 12, opacity: 0.65, flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {kbd && (
          <span style={{
            fontFamily: T.fontMono, fontSize: 10, color: T.ink40,
            padding: '1px 4px', background: T.paperMuted,
            border: `1px solid ${T.hairline}`, borderRadius: 3,
          }}>{kbd}</span>
        )}
        {hasArrow && <span style={{ color: T.ink40, fontSize: 11 }}>›</span>}
      </button>
    );
  }

  function Divider() {
    return <div style={{ height: 1, background: T.hairlineSoft, margin: '3px 0' }} />;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onContextMenu={e => e.preventDefault()}>
      <div ref={ref} style={{
        position: 'absolute', left: pos.x, top: pos.y,
        background: T.paper, border: `1px solid ${T.hairline}`,
        borderRadius: T.r6,
        boxShadow: '0 8px 20px rgba(25,25,26,0.14), 0 1px 4px rgba(25,25,26,0.07)',
        width: 224, overflow: 'hidden',
        padding: '4px 0',
        animation: 'fadeUp 0.08s ease-out',
      }}>
        <MenuItem
          icon="✓"
          label={isDone ? t('task.markIncomplete') : t('task.markComplete')}
          kbd={t('kbd.space')}
          onClick={() => { onStatusChange(task, isDone ? 'not_started' : 'done'); onClose(); }}
        />
        <MenuItem
          icon="↗"
          label={t('menu.openDetail')}
          kbd="↵"
          onClick={() => { onOpenDetail?.(task); onClose(); }}
        />
        <Divider />
        {/* Priority (1.8.0): the six levels in one row, and « the assistant decides ». */}
        <div data-menu="priority" style={{ padding: '6px 12px 4px' }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink40, marginBottom: 6 }}>{t('detail.priority')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {LEVEL_IDS.map(id => (
              <button key={id} type="button" title={t(LEVEL_STYLE[id].key)} aria-label={t(LEVEL_STYLE[id].key)} aria-pressed={task.priority === id} data-level={id}
                onClick={() => setPriority(id)} style={{
                  width: 22, height: 22, borderRadius: 5, cursor: 'pointer', padding: 0,
                  background: LEVEL_STYLE[id].color, border: `2px solid ${task.priority === id ? T.ink : 'transparent'}`,
                }} />
            ))}
            <button type="button" onClick={() => setPriority(null)} aria-pressed={!task.priority} style={{
              marginLeft: 4, fontSize: 11, fontFamily: T.fontUI, padding: '3px 6px', borderRadius: 4, cursor: 'pointer',
              background: !task.priority ? T.paperSubtle : 'transparent', color: T.ink60, border: `1px solid ${T.hairline}`,
            }}>{t('level.aiShort')}</button>
          </div>
        </div>
        <Divider />
        <MenuItem
          icon="◷"
          label={t('menu.schedule')}
          hasArrow
          muted
          onClick={() => { onSchedule?.(task, pos.x + 228, pos.y); onClose(); }}
        />
        {onSomeday && task.status !== 'done' && (
          <MenuItem icon="☁" muted label={t(task.someday ? 'someday.bringBack' : 'someday.put')}
            onClick={() => { onSomeday(task, !task.someday); onClose(); }} />
        )}
        {!showMoveToArea ? (
          <MenuItem
            icon="⤢"
            label={t('menu.moveToTopic')}
            hasArrow
            muted
            onClick={() => setShowMoveToArea(true)}
          />
        ) : (
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '4px 12px 6px', fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink40 }}>
              {t('menu.moveToTopic')}
            </div>
            {areas.length === 0 ? (
              <div style={{ padding: '4px 12px 8px', fontSize: 12, color: T.ink40, fontFamily: T.fontUI }}>{t('menu.noTopics')}</div>
            ) : areas.map(tag => {
              const isCurrent = task.tags?.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={e => { e.stopPropagation(); moveToArea(tag); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', height: 30, padding: '0 12px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: T.fontUI, fontSize: 12.5, textAlign: 'left',
                    color: isCurrent ? T.ink40 : T.ink,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = T.paperSubtle}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.ink40, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{tag}</span>
                  {isCurrent && <span style={{ fontSize: 10, color: T.ink40 }}>{t('menu.current')}</span>}
                </button>
              );
            })}
            <button onClick={() => setShowMoveToArea(false)} style={{
              width: '100%', padding: '4px 12px', background: 'transparent', border: 'none',
              cursor: 'pointer', fontSize: 11.5, color: T.ink40, textAlign: 'left',
              fontFamily: T.fontUI,
            }}>{t('menu.back')}</button>
          </div>
        )}
        {onFocusMode && task.status !== 'done' && (
          <MenuItem
            icon="◎"
            label={t('menu.enterFocus')}
            onClick={() => { onFocusMode(task); onClose(); }}
          />
        )}
        <MenuItem
          icon="⊕"
          label={t('menu.addSubtask')}
          onClick={() => { onEdit(task); onClose(); }}
        />
        <Divider />
        <MenuItem
          icon="⌫"
          label={t('menu.delete')}
          kbd={t('kbd.del')}
          danger
          onClick={() => { onDelete(task.id); onClose(); }}
        />
      </div>
    </div>
  );
}

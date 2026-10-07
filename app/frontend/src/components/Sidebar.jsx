import { useState, useMemo, useRef } from 'react';
import ApertureMark from './ApertureMark.jsx';
import { useAssistantDownload } from '../assistantDownload.js';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

// Custom SVG icons for collapsed rail
const IcoInbox = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="2" width="13" height="12" rx="1.75" stroke={color} strokeWidth="1.2" />
    <path d="M1.5 9.5h3l1.5 2h4l1.5-2H14.5" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const IcoToday = ({ color, accent }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.2" />
    <circle cx="8" cy="8" r="2.5" fill={accent || color} />
  </svg>
);

const IcoUpcoming = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.75" y="3" width="12.5" height="11.25" rx="1.75" stroke={color} strokeWidth="1.2" />
    <path d="M1.75 6.5h12.5" stroke={color} strokeWidth="1.2" />
    <path d="M5.5 1.5v3M10.5 1.5v3" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const IcoAnytime = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const IcoSomeday = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 2h8v12.5L8 12l-4 2.5V2Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const IcoHistory = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.2" />
    <path d="M8 5v3.5l2.5 1.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IcoGraph = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="4" r="1.75" stroke={color} strokeWidth="1.2" />
    <circle cx="3" cy="12" r="1.75" stroke={color} strokeWidth="1.2" />
    <circle cx="13" cy="12" r="1.75" stroke={color} strokeWidth="1.2" />
    <line x1="6.7" y1="5.3" x2="4.2" y2="10.7" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="9.3" y1="5.3" x2="11.8" y2="10.7" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="4.75" y1="12" x2="11.25" y2="12" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

function AskClarityNavItem({ active, onClick, T }) {
  const { t } = useLocale();
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', borderRadius: T.r6, width: '100%',
        background: active ? T.paper : hov ? T.hairlineSoft : 'transparent',
        boxShadow: active ? `inset 0 0 0 1px ${T.hairline}` : 'none',
        border: 'none', cursor: 'pointer', fontFamily: T.fontUI,
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: active ? T.ink : T.ink80, fontWeight: active ? 500 : 400 }}>{t('nav.askClarity')}</span>
      </div>
      <span style={{
        fontFamily: T.fontMono, fontSize: 10, color: T.ink40,
        padding: '2px 5px', background: T.paperMuted, borderRadius: 3,
        border: `1px solid ${T.hairline}`,
      }}>Ctrl+/</span>
    </button>
  );
}

const IcoPatterns = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <line x1="2.5" y1="13.5" x2="13.5" y2="13.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <rect x="3" y="8.5" width="2.4" height="4" stroke={color} strokeWidth="1.2" />
    <rect x="6.8" y="5" width="2.4" height="7.5" stroke={color} strokeWidth="1.2" />
    <rect x="10.6" y="2.5" width="2.4" height="10" stroke={color} strokeWidth="1.2" />
  </svg>
);

// Labels are keys, not text: they are resolved at render time so switching
// language re-renders them, rather than being frozen when this module loaded.
const NAV_ITEMS = [
  { id: 'inbox',    labelKey: 'nav.inbox',    view: 'tasks',    Icon: IcoInbox },
  { id: 'today',    labelKey: 'nav.today',    view: 'focus',    Icon: IcoToday },
  { id: 'upcoming', labelKey: 'nav.calendar', view: 'calendar', Icon: IcoUpcoming },
  { id: 'anytime',  labelKey: 'nav.anytime',  view: 'tasks',    Icon: IcoAnytime },
  { id: 'someday',  labelKey: 'nav.archive',  view: 'archive',  Icon: IcoSomeday },
  { id: 'history',  labelKey: 'nav.history',  view: 'history',  Icon: IcoHistory },
  { id: 'graph',    labelKey: 'nav.graph',    view: 'graph',    Icon: IcoGraph },
  { id: 'patterns', labelKey: 'nav.patterns', view: 'patterns', Icon: IcoPatterns },
];

function NavItemCollapsed({ item, active, onClick, accent, T, label }) {
  const [hov, setHov] = useState(false);
  const color = active ? T.ink : hov ? T.ink80 : T.ink60;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 34, width: '100%',
        borderRadius: T.r6,
        background: active ? T.paper : hov ? T.hairlineSoft : 'transparent',
        boxShadow: active ? `inset 0 0 0 1px ${T.hairline}` : 'none',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      <item.Icon color={color} accent={accent} />
    </button>
  );
}

function NavItemExpanded({ item, active, onClick, count, T, label }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 9, padding: '7px 10px',
        borderRadius: T.r6, width: '100%',
        background: active ? T.paper : hov ? T.hairlineSoft : 'transparent',
        boxShadow: active ? `inset 0 0 0 1px ${T.hairline}` : 'none',
        fontSize: 13.5,
        color: active ? T.ink : T.ink80,
        fontWeight: active ? 500 : 400,
        border: 'none', cursor: 'pointer',
        fontFamily: T.fontUI,
        transition: 'background 0.1s',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, color: active ? T.ink : T.ink60 }}>
        <item.Icon color={active ? T.ink : T.ink60} accent={T.accent} />
        <span style={{ color: active ? T.ink : T.ink80 }}>{label}</span>
      </span>
      {count !== undefined && count > 0 && (
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: active ? T.ink60 : T.ink40 }}>
          {count}
        </span>
      )}
    </button>
  );
}

function AreaItemExpanded({ tag, count, active, onClick, T }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center',
        borderRadius: T.r6,
        background: active ? T.paper : hov ? T.hairlineSoft : 'transparent',
        boxShadow: active ? `inset 0 0 0 1px ${T.hairline}` : 'none',
        transition: 'background 0.1s',
      }}
    >
      <button
        onClick={onClick}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 9, padding: '7px 10px',
          fontSize: 13, color: active ? T.ink : T.ink80,
          fontWeight: active ? 500 : 400,
          border: 'none', cursor: 'pointer',
          fontFamily: T.fontUI, background: 'transparent',
          borderRadius: T.r6,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.ink40, flexShrink: 0 }} />
          <span>{tag}</span>
        </span>
        {count > 0 && (
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>{count}</span>
        )}
      </button>
    </div>
  );
}

function getUserName() {
  try { return localStorage.getItem('clarity-userName') || ''; } catch { return ''; }
}

export default function Sidebar({
  view, setView, health, analyzing, onAddTask, onChat, onExport, onReanalyze,
  taskCount, archivedCount, allTasks, activeArea, onAreaClick, onOpenSettings, onOpenAiSettings,
  onFeedback,   // null while no feedback form is configured: nothing is shown
}) {
  // While the built-in assistant downloads, say so: a new tester's first
  // minutes otherwise showed "AI offline" in orange, as if something had broken.
  const downloading = useAssistantDownload(!health.ollama);
  const { T } = useTheme();
  const { t } = useLocale();
  const userName = getUserName();
  const userInitial = userName ? userName.trim()[0].toUpperCase() : 'C';
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [addingTopic, setAddingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const newTopicRef = useRef(null);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
  }

  // Extract unique tags from allTasks
  const areas = useMemo(() => {
    if (!allTasks?.length) return [];
    const tagMap = {};
    allTasks.forEach(t => {
      t.tags?.forEach(tag => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });
    return Object.entries(tagMap).map(([tag, count]) => ({ tag, count }));
  }, [allTasks]);

  const getCount = (item) => {
    if (item.id === 'inbox') return taskCount;
    if (item.id === 'anytime') return (allTasks || []).filter(t => !t.deadline && t.status !== 'done').length;
    if (item.id === 'someday') return archivedCount;
    if (item.id === 'today') return taskCount;
    return undefined;
  };

  const isActive = (item) => {
    if (item.id === 'inbox' || item.id === 'anytime') return view === 'tasks' && !activeArea;
    if (item.id === 'today') return view === 'focus';
    if (item.id === 'upcoming') return view === 'calendar';
    if (item.id === 'someday') return view === 'archive';
    if (item.id === 'history') return view === 'history';
    if (item.id === 'graph') return view === 'graph';
    return false;
  };

  const w = collapsed ? 52 : 232;

  if (collapsed) {
    return (
      <aside style={{
        width: w, flexShrink: 0,
        borderRight: `1px solid ${T.hairline}`,
        padding: '14px 6px',
        display: 'flex', flexDirection: 'column', gap: 6,
        background: T.paperSubtle,
        boxSizing: 'border-box',
        overflow: 'hidden',
        transition: 'width 0.18s ease, padding 0.18s ease',
        alignItems: 'center',
      }}>
        {/* Brand */}
        <button onClick={toggleCollapse} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '6px 0', width: '100%',
          display: 'flex', justifyContent: 'center',
          marginBottom: 8,
        }} title={t('nav.expandSidebar')}>
          <ApertureMark s={20} />
        </button>

        {/* Nav items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
          {NAV_ITEMS.map(item => (
            <NavItemCollapsed
              key={item.id}
              item={item}
              label={t(item.labelKey)}
              active={isActive(item)}
              onClick={() => setView(item.view)}
              accent={T.accent}
              T={T}
            />
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Expand chevron */}
        <button onClick={toggleCollapse} style={{
          width: 26, height: 18,
          background: T.paper, borderRadius: T.r6,
          border: `1px solid ${T.hairline}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: T.ink40, fontSize: 11,
          padding: 0, marginBottom: 8,
        }} title={t('nav.expandSidebar')}>
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
            <path d="M2 2l4 4-4 4" stroke={T.ink40} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Bottom: status dot + gear + avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div
            title={health.ollama ? (health.model ? t('sidebar.aiModel', { model: health.model }) : t('sidebar.aiConnected')) : t('sidebar.aiOfflineLong')}
            onClick={() => !health.ollama && (onOpenAiSettings ? onOpenAiSettings() : setView('settings'))}
            style={{ cursor: health.ollama ? 'default' : 'pointer' }}
          >
            <span style={{
              display: 'block',
              width: 7, height: 7, borderRadius: '50%',
              background: health.ollama ? T.done : T.ink40,
              boxShadow: health.ollama ? `0 0 0 3px ${T.done}30` : 'none',
            }} />
          </div>
          {onFeedback && <FeedbackBtn onClick={onFeedback} T={T} />}
          <SettingsGearBtn onClick={onOpenSettings} T={T} />
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: T.ink, color: T.paper,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, fontWeight: 600, fontFamily: T.fontUI,
          }}>{userInitial}</div>
        </div>
      </aside>
    );
  }

  return (
    <aside style={{
      width: w, flexShrink: 0,
      borderRight: `1px solid ${T.hairline}`,
      padding: '20px 14px',
      display: 'flex', flexDirection: 'column', gap: 20,
      background: T.paperSubtle,
      boxSizing: 'border-box',
      overflowY: 'auto', overflowX: 'hidden',
      transition: 'width 0.18s ease, padding 0.18s ease',
    }}>
      {/* Brand row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ApertureMark s={20} />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: T.fontUI }}>clarity</span>
        </div>
        <button onClick={toggleCollapse} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: T.ink40, padding: '3px 4px', borderRadius: 4, lineHeight: 1,
        }} title={t('nav.collapseSidebar')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Primary nav + Ask Clarity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV_ITEMS.map(item => (
          <NavItemExpanded
            key={item.id}
            item={item}
            label={t(item.labelKey)}
            active={isActive(item)}
            onClick={() => setView(item.view)}
            count={getCount(item)}
            T={T}
          />
        ))}
        <div style={{ height: 8 }} />
        <AskClarityNavItem active={false} onClick={onChat} T={T} />
      </div>

      {/* Topics section */}
      <div>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: T.ink40, padding: '0 10px 10px',
        }}>{t('nav.topics')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {areas.map(({ tag, count }) => (
            <AreaItemExpanded
              key={tag}
              tag={tag}
              count={count}
              active={(view === 'tasks' || view === 'topic-detail') && activeArea === tag}
              onClick={() => onAreaClick?.(tag)}
              T={T}
            />
          ))}

          {/* + New topic row */}
          {addingTopic ? (
            <div style={{ padding: '4px 6px' }}>
              <input
                ref={newTopicRef}
                autoFocus
                value={newTopicName}
                onChange={e => setNewTopicName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTopicName.trim()) {
                    onAreaClick?.(newTopicName.trim());
                    setView('tasks');
                    setNewTopicName('');
                    setAddingTopic(false);
                  }
                  if (e.key === 'Escape') { setAddingTopic(false); setNewTopicName(''); }
                }}
                onBlur={() => { setAddingTopic(false); setNewTopicName(''); }}
                placeholder={t('nav.topicNamePlaceholder')}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '5px 8px',
                  background: T.paper, border: `1px solid ${T.accent}`,
                  borderRadius: T.r6, fontSize: 12.5, color: T.ink,
                  fontFamily: T.fontUI, outline: 'none',
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingTopic(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', width: '100%',
                fontSize: 12.5, color: T.ink40,
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: T.fontUI, borderRadius: T.r6,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = T.ink60; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.ink40; }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
              <span>{t('nav.newTopic')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom: AI status + user row */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* LocalBadge */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px',
            background: T.paper, borderRadius: T.r6,
            border: `1px solid ${T.hairline}`,
            cursor: health.ollama ? 'default' : 'pointer',
          }}
          onClick={() => !health.ollama && (onOpenAiSettings ? onOpenAiSettings() : setView('settings'))}
        >
          <span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', background: health.ollama ? T.done : T.ink40, flexShrink: 0 }}>
            {health.ollama && (
              <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `1px solid ${T.done}`, opacity: 0.35 }} />
            )}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1, minWidth: 0 }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink60 }}>
              {analyzing ? t('sidebar.analyzing') : t('tray.onDevice')}
            </span>
            <span style={{ fontSize: 11.5, color: health.ollama || downloading !== null ? T.ink80 : T.warn, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {health.ollama ? (health.model ? t('sidebar.clarityAiModel', { model: health.model }) : t('sidebar.clarityAiLocal'))
                : downloading !== null ? t('sidebar.aiDownloading', { percent: downloading })
                : t('sidebar.aiOffline')}
            </span>
          </div>
        </div>

        {onFeedback && (
          <button
            onClick={onFeedback}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', width: '100%',
              fontSize: 12.5, color: T.ink60,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: T.fontUI, borderRadius: T.r6, textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = T.ink; e.currentTarget.style.background = T.paperMuted; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.ink60; e.currentTarget.style.background = 'transparent'; }}
          >
            <FeedbackIcon />
            <span>{t('feedback.give')}</span>
          </button>
        )}

        {/* User + Settings row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: T.ink, color: T.paper,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10.5, fontWeight: 600, flexShrink: 0, fontFamily: T.fontUI,
            }}>{userInitial}</div>
            <div style={{ fontSize: 12.5, color: T.ink80 }}>{userName || 'Clarity'}</div>
          </div>
          <SettingsGearBtn onClick={onOpenSettings} T={T} />
        </div>
      </div>
    </aside>
  );
}

function FeedbackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FeedbackBtn({ onClick, T }) {
  const { t } = useLocale();
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={t('feedback.give')}
      aria-label={t('feedback.give')}
      style={{
        width: 26, height: 26, borderRadius: T.r6, flexShrink: 0,
        background: hov ? T.paperMuted : 'transparent',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hov ? T.ink60 : T.ink40,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      <FeedbackIcon />
    </button>
  );
}

function SettingsGearBtn({ onClick, T }) {
  const { t } = useLocale();
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={t('nav.settings')}
      style={{
        width: 26, height: 26, borderRadius: T.r6, flexShrink: 0,
        background: hov ? T.paperMuted : 'transparent',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hov ? T.ink60 : T.ink40,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </button>
  );
}

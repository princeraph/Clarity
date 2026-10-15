import { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useBackdropClose } from '../hooks/useBackdropClose.js';
import { getShortcutKeys } from '../shortcuts.js';

// The cheat sheet: every shortcut, with the keys as they are set now
// (Settings › Keyboard), not as they were by default. Opened by « ? », the
// command list (Ctrl+K) and Settings › Keyboard.
const GROUPS = [
  { titleKey: 'shortcuts.everywhere', rows: [
    { id: 'capture',  labelKey: 'settings.quickCapture' },
    { id: 'chat',     labelKey: 'settings.kb.toggleChat' },
    { keys: ['Ctrl', 'Alt', 'Space'], labelKey: 'shortcuts.panel' },
    { id: 'focus',    labelKey: 'settings.kb.focusView' },
    { id: 'tasks',    labelKey: 'tasks.allTasks' },
    { id: 'calendar', labelKey: 'nav.calendar' },
    { id: 'graph',    labelKey: 'settings.kb.graphView' },
    { id: 'settings', labelKey: 'settings.title' },
    { id: 'theme',    labelKey: 'settings.kb.toggleTheme' },
    { keys: ['?'],    labelKey: 'shortcuts.sheet' },
  ] },
  { titleKey: 'shortcuts.inList', rows: [
    { keys: ['↑', '↓'], labelKey: 'shortcuts.move' },
    { id: 'complete', labelKey: 'task.markComplete' },
    { id: 'detail',   labelKey: 'menu.openDetail' },
    { id: 'delete',   labelKey: 'settings.kb.deleteTask' },
  ] },
  { titleKey: 'shortcuts.inCapture', rows: [
    { keys: ['↵'],        labelKey: 'capture.kbd.save' },
    { keys: ['Ctrl', '↵'], labelKey: 'capture.kbd.saveOpen' },
    { keys: ['Esc'],      labelKey: 'capture.kbd.back' },
  ] },
];

export default function ShortcutsSheet({ onClose }) {
  const { T } = useTheme();
  const { t } = useLocale();
  const backdrop = useBackdropClose(onClose);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const name = (k) => (k === 'Space' ? t('shortcuts.space') : k === 'Esc' ? t('kbd.esc') : k);
  const Kbd = ({ k }) => (
    <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink80, padding: '2px 6px', background: T.paperMuted, border: `1px solid ${T.hairline}`, borderRadius: 4 }}>{name(k)}</span>
  );

  return (
    <div className="clarity-backdrop" {...backdrop} style={{ position: 'fixed', inset: 0, zIndex: 170, background: 'rgba(25,25,26,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: T.fontUI }}>
      <div role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" className="clarity-pop" style={{
        background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: T.r14, boxShadow: '0 24px 60px rgba(25,25,26,0.15)',
        width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', padding: '22px 26px', boxSizing: 'border-box',
      }}>
        <h2 id="shortcuts-title" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600, color: T.ink }}>{t('shortcuts.title')}</h2>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: T.ink60 }}>{t('shortcuts.hint')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px 28px' }}>
          {GROUPS.map(g => (
            <section key={g.titleKey}>
              <h3 style={{ margin: '0 0 8px', fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, fontWeight: 400 }}>{t(g.titleKey)}</h3>
              {g.rows.map(r => {
                const keys = r.keys || getShortcutKeys(r.id);
                return (
                  <div key={r.labelKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: `1px solid ${T.hairlineSoft}` }}>
                    <span style={{ fontSize: 13, color: T.ink80 }}>{t(r.labelKey)}</span>
                    <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{keys.map(k => <Kbd key={k} k={k} />)}</span>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

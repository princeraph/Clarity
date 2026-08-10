import { useTheme } from '../../contexts/ThemeContext.jsx';

export default function ArchiveView({ archivedTasks, onRestore, onDelete, onAddTask }) {
  const { T } = useTheme();

  const statusLabel = (s) => s.replace('_', ' ');

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '36px 56px', fontFamily: T.fontUI, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>Archive</div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: T.ink }}>
          {archivedTasks.length} archived task{archivedTasks.length !== 1 ? 's' : ''}
        </h1>
      </div>

      {archivedTasks.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 64, textAlign: 'center' }}>
          {/* Bookmark stack illustration */}
          <svg width="96" height="80" viewBox="0 0 96 80" fill="none">
            <rect x="26" y="18" width="44" height="52" rx="5" fill={T.paperMuted} stroke={T.hairline} strokeWidth="1.2" />
            <rect x="20" y="14" width="44" height="52" rx="5" fill={T.paperSubtle} stroke={T.hairline} strokeWidth="1.2" />
            <path d="M20 14h44v38L42 62 20 52V14Z" fill={T.paper} stroke={T.hairline} strokeWidth="1.2" />
            <rect x="28" y="26" width="28" height="2.5" rx="1.25" fill={T.ink20} />
            <rect x="28" y="32" width="20" height="2.5" rx="1.25" fill={T.ink20} />
            <rect x="28" y="38" width="24" height="2.5" rx="1.25" fill={T.ink20} />
            <path d="M42 18l1.5 4.5h4.7l-3.8 2.8 1.4 4.5L42 27l-3.8 2.8 1.4-4.5-3.8-2.8h4.7z" fill={T.accentSoft} stroke={T.accent} strokeWidth="0.8" />
          </svg>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: T.ink }}>Ideas live here.</h2>
          <p style={{ margin: 0, fontSize: 14.5, color: T.ink60, lineHeight: 1.6, maxWidth: 380 }}>
            Archive is for things you want to do but not now. No due dates, no pressure — just a place to park what matters eventually.
          </p>
          <button onClick={onAddTask} style={{
            fontFamily: T.fontUI, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            padding: '9px 16px', borderRadius: T.r6,
            background: T.ink, color: T.paper, border: 'none',
          }}>Add to Archive</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {archivedTasks.map(task => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16,
              padding: '13px 4px',
              borderBottom: `1px solid ${T.hairlineSoft}`,
              opacity: 0.65,
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.65'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 14.5, color: T.ink, textDecoration: 'line-through', fontWeight: 400 }}>{task.title}</h3>
                {task.description && (
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: T.ink60, lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {task.description}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{statusLabel(task.status)}</span>
                  {task.archivedAt && (
                    <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>
                      Archived {new Date(task.archivedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => onRestore(task.id)} style={{
                  fontSize: 12.5, padding: '5px 12px', borderRadius: T.r6,
                  background: T.paperSubtle, color: T.ink60,
                  border: `1px solid ${T.hairline}`, cursor: 'pointer', fontFamily: T.fontUI,
                }}>Restore</button>
                <button onClick={() => onDelete(task.id)} style={{
                  fontSize: 12.5, padding: '5px 12px', borderRadius: T.r6,
                  background: T.paperSubtle, color: T.danger,
                  border: `1px solid ${T.dangerBorder}`, cursor: 'pointer', fontFamily: T.fontUI,
                }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

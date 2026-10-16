import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { levelTone, kindTone, LEVEL_STYLE } from '../lib/niveaux.js';
import { toHHMM } from '../lib/journee.js';

// The time grid (2.1.0): hours down the side, blocks as tall as they last,
// each in the soft color of its level — the day plan on Today and the week in
// Calendar. Where blocks go (lanes, the hours shown) is lib/journee.js's
// layoutDay; this only draws.
//
// An item: { id, kind: 'task'|'fixed'|'batch'|'event'|'break', level,
// inherited, title, start, end (minutes), done, sub: [{ id, title, done }],
// detail, taskId, lane, lanes }.

export const PX_PER_MIN = 0.9;
const GUTTER = 48;

function Block({ it, from, px, onOpen, T, isDark, t, fmtDuration }) {
  const isTask = it.kind === 'task' || it.kind === 'fixed';
  const tone = isTask ? levelTone(it.level, isDark) : kindTone(it.kind, isDark);
  const weight = isTask ? LEVEL_STYLE[it.level]?.weight || 3 : it.kind === 'break' ? 0 : 3;
  const height = Math.max(18, (it.end - it.start) * px - 2);
  const roomy = height >= 36, tall = height >= 54;
  const open = (id) => id && onOpen?.(id);
  const clickable = !!(it.taskId || it.sub?.length) && !!onOpen;
  const lane = it.lanes > 1 ? { left: `calc(${(it.lane * 100) / it.lanes}% + 2px)`, width: `calc(${100 / it.lanes}% - 4px)` } : { left: 2, right: 2 };

  return (
    <div
      data-block={it.kind} data-start={toHHMM(it.start)} data-end={toHHMM(it.end)} data-task={it.taskId || undefined}
      data-level={isTask ? it.level : undefined} data-done={it.done ? '' : undefined}
      role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
      aria-label={`${it.title}, ${toHHMM(it.start)}–${toHHMM(it.end)}${isTask ? `, ${t(LEVEL_STYLE[it.level]?.key || 'level.medium')}` : ''}`}
      onClick={clickable ? () => open(it.taskId || it.sub[0]?.id) : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') { e.preventDefault(); open(it.taskId || it.sub[0]?.id); } } : undefined}
      className={clickable ? 'clarity-block' : undefined}
      style={{
        position: 'absolute', top: (it.start - from) * px + 1, height, ...lane,
        boxSizing: 'border-box', overflow: 'hidden',
        padding: height < 24 ? '1px 8px' : '4px 8px',
        borderRadius: 6,
        background: it.kind === 'break'
          ? `repeating-linear-gradient(135deg, ${tone.fill} 0 7px, transparent 7px 12px)`
          : tone.fill,
        borderLeft: weight ? `${weight}px ${it.inherited ? 'dashed' : 'solid'} ${tone.bar}` : 'none',
        color: it.kind === 'break' ? T.ink60 : tone.ink,
        opacity: it.done ? 0.55 : 1,
        cursor: clickable ? 'pointer' : 'default',
        fontFamily: T.fontUI,
        transition: 'filter 0.12s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {it.kind !== 'break' && (
          <span aria-hidden="true" style={{
            width: 9, height: 9, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
            border: `1.5px solid ${tone.bar}`, background: it.done ? tone.bar : 'transparent',
          }} />
        )}
        <span style={{
          flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: it.kind === 'break' ? 400 : 600, letterSpacing: '-0.005em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: it.done ? 'line-through' : 'none',
        }}>{it.title}</span>
        {!roomy && it.kind !== 'break' && (
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, opacity: 0.7, flexShrink: 0 }}>{toHHMM(it.start)}</span>
        )}
      </div>
      {roomy && (
        <div data-duration style={{ fontFamily: T.fontMono, fontSize: 10.5, opacity: 0.72, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {toHHMM(it.start)}–{toHHMM(it.end)} · {it.detail || fmtDuration(it.end - it.start)}
        </div>
      )}
      {tall && it.sub?.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '3px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {it.sub.map(s => (
            <li key={s.id}>
              <button type="button" data-sub={s.id} onClick={(e) => { e.stopPropagation(); open(s.id); }} style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit',
                fontSize: 11.5, fontFamily: T.fontUI, textAlign: 'left', opacity: s.done ? 0.55 : 0.9,
                textDecoration: s.done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>• {s.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * `columns`: [{ key, header (node, optional), items (laid out), shaded, nowMin (or null), onEmpty }].
 * `from`, `to`: minutes. One column is the day plan; seven, the week.
 */
export default function TimeGrid({ columns, from, to, px = PX_PER_MIN, onOpen, testId }) {
  const { T, isDark } = useTheme();
  const { t, fmtDuration } = useLocale();
  const hours = [];
  for (let m = from; m <= to; m += 60) hours.push(m);
  const height = (to - from) * px;
  const anyHeader = columns.some(c => c.header);

  return (
    <div data-time-grid={testId || ''} style={{ display: 'flex', flexDirection: 'column', fontFamily: T.fontUI }}>
      {anyHeader && (
        <div style={{ display: 'flex', paddingLeft: GUTTER, borderBottom: `1px solid ${T.hairline}` }}>
          {columns.map(c => <div key={c.key} style={{ flex: 1, minWidth: 0 }}>{c.header}</div>)}
        </div>
      )}
      <div style={{ display: 'flex', position: 'relative', height: height + 8, paddingTop: 6 }}>
        {/* Hours */}
        <div aria-hidden="true" style={{ width: GUTTER, flexShrink: 0, position: 'relative' }}>
          {hours.map(m => (
            <span key={m} style={{
              position: 'absolute', top: (m - from) * px - 6, right: 8,
              fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, letterSpacing: '0.02em',
            }}>{toHHMM(m)}</span>
          ))}
        </div>
        {columns.map((c, ci) => (
          <div key={c.key} data-column={c.key} style={{
            flex: 1, minWidth: 0, position: 'relative', height,
            borderLeft: ci > 0 ? `1px solid ${T.hairlineSoft}` : 'none',
            background: c.shaded ? T.paperMuted : 'transparent',
          }}>
            {hours.map(m => (
              <div key={m} aria-hidden="true" style={{ position: 'absolute', top: (m - from) * px, left: 0, right: 0, borderTop: `1px solid ${T.hairlineSoft}` }} />
            ))}
            {c.items.map(it => <Block key={it.id} it={it} from={from} px={px} onOpen={onOpen} T={T} isDark={isDark} t={t} fmtDuration={fmtDuration} />)}
            {c.nowMin != null && c.nowMin >= from && c.nowMin <= to && (
              <div data-now-line aria-hidden="true" style={{ position: 'absolute', top: (c.nowMin - from) * px, left: -1, right: 0, height: 2, background: T.danger, zIndex: 3, pointerEvents: 'none' }}>
                <span style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: T.danger }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

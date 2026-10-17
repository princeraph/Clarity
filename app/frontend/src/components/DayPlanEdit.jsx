import { useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { toHHMM, toMin } from '../lib/journee.js';

// The day plan, changed by hand (2.2.0): what a selected block can do, and
// the tools under the grid — add a task, add a break, other hours for today,
// what was taken out of today. Every change goes through `edit(change)`,
// which DayPlan keeps for the day (lib/journee.js reads it as `edits`).

const button = (T, primary) => ({ padding: '5px 10px', fontSize: 12, fontFamily: T.fontUI, borderRadius: T.r6, cursor: 'pointer', whiteSpace: 'nowrap',
  ...(primary ? { background: T.ink, color: T.paper, border: 'none' } : { background: T.paper, color: T.ink80, border: `1px solid ${T.hairline}` }) });
const input = (T, w) => ({ padding: '4px 6px', fontSize: 12.5, fontFamily: T.fontMono, background: T.paper, color: T.ink, border: `1px solid ${T.hairline}`, borderRadius: T.r6, width: w });

/** What one selected block can do. */
export function SelectedPanel({ block, task, edits, edit, onNudge, onOpen, onClose, onKeepEstimate, T }) {
  const { t } = useLocale();
  const [at, setAt] = useState(toHHMM(block.start));
  const [minutes, setMinutes] = useState(String(block.end - block.start));
  const [keep, setKeep] = useState(false);
  const id = block.taskId;
  const pinned = id && edits.pins?.[id] != null;
  const row = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
  const without = (obj, k) => { const o = { ...(obj || {}) }; delete o[k]; return o; };

  if (block.kind === 'pause') {
    return (
      <div data-selected-panel="pause" style={{ ...row, marginTop: 10 }}>
        <span style={{ fontSize: 12.5, color: T.ink80 }}>{t('day.break')} · {toHHMM(block.start)}–{toHHMM(block.end)}</span>
        <button type="button" data-act="remove-pause" onClick={() => { edit({ breaks: (edits.breaks || []).filter(b => !(b.start === block.start && b.end === block.end)) }); onClose(); }} style={button(T)}>{t('day.removePause')}</button>
        <button type="button" onClick={onClose} style={{ ...button(T), border: 'none', background: 'transparent', color: T.ink60 }}>{t('day.sel.close')}</button>
      </div>
    );
  }
  return (
    <div data-selected-panel={block.kind} style={{ marginTop: 10, padding: '10px 12px', border: `1px solid ${T.hairline}`, borderRadius: T.r10, background: T.paper, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.title}</div>
      <div style={row}>
        <button type="button" data-act="earlier" onClick={() => onNudge(block, -1)} style={button(T)}>↑ {t('day.sel.earlier')}</button>
        <button type="button" data-act="later-block" onClick={() => onNudge(block, 1)} style={button(T)}>↓ {t('day.sel.later')}</button>
        {block.kind === 'batch' && <button type="button" data-act="ungroup" onClick={() => { edit({ ungrouped: true }); onClose(); }} style={button(T)}>{t('day.sel.ungroup')}</button>}
      </div>
      {id && (
        <>
          <div style={row}>
            <span style={{ fontSize: 12, color: T.ink60, minWidth: 74 }}>{t('day.sel.at')}</span>
            <input type="time" name="pin-at" value={at} onChange={e => setAt(e.target.value)} style={input(T, 96)} />
            <button type="button" data-act="pin" onClick={() => at && edit({ pins: { ...(edits.pins || {}), [id]: toMin(at) } })} style={button(T, true)}>📌 {t('day.sel.pin')}</button>
            {pinned && <button type="button" data-act="unpin" onClick={() => edit({ pins: without(edits.pins, id) })} style={button(T)}>{t('day.sel.unpin')}</button>}
          </div>
          <div style={row}>
            <span style={{ fontSize: 12, color: T.ink60, minWidth: 74 }}>{t('day.sel.minutes')}</span>
            <input type="number" name="duration" min={5} max={600} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} style={input(T, 70)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.ink80, cursor: 'pointer' }}>
              <input type="checkbox" name="keep-estimate" checked={keep} onChange={e => setKeep(e.target.checked)} /> {t('day.sel.keepEstimate')}
            </label>
            <button type="button" data-act="set-duration" onClick={() => {
              const m = Math.round(Number(minutes) / 5) * 5;
              if (!(m >= 5 && m <= 600)) return;
              edit({ durations: { ...(edits.durations || {}), [id]: m } });
              if (keep) onKeepEstimate(id, m);
            }} style={button(T, true)}>{t('day.sel.setDuration')}</button>
          </div>
        </>
      )}
      <div style={row}>
        <button type="button" data-act="remove-today" onClick={() => {
          const ids = block.taskIds || [id];
          edit({ excluded: [...new Set([...(edits.excluded || []), ...ids])], included: (edits.included || []).filter(x => !ids.includes(x)), pins: ids.reduce((p, x) => without(p, x), edits.pins) });
          onClose();
        }} style={button(T)}>{t('day.sel.remove')}</button>
        {(id || block.taskIds?.[0]) && <button type="button" data-act="open" onClick={() => onOpen(id || block.taskIds[0])} style={button(T)}>{t('day.sel.open')}</button>}
        <button type="button" onClick={onClose} style={{ ...button(T), border: 'none', background: 'transparent', color: T.ink60 }}>{t('day.sel.close')}</button>
      </div>
    </div>
  );
}

/** Under the grid: add a task, add a break, hours for today, and what is out of today. */
export function PlanTools({ candidates, excludedTasks, hours, edits, edit, T }) {
  const { t, fmtDuration } = useLocale();
  const [pick, setPick] = useState('');
  const [pauseAt, setPauseAt] = useState('15:00');
  const [pauseFor, setPauseFor] = useState('15');
  const row = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
  const small = { fontSize: 12, color: T.ink60 };
  return (
    <div data-plan-tools style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.hairlineSoft}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...small, fontSize: 11.5 }}>{t('day.hint')}</div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {candidates.length > 0 && (
          <div style={row}>
            <select name="add-task" value={pick} onChange={e => setPick(e.target.value)} style={{ ...input(T, 210), fontFamily: T.fontUI }}>
              <option value="">{t('day.addTaskPick')}</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <button type="button" data-act="add-task" disabled={!pick} onClick={() => {
              edit({ included: [...new Set([...(edits.included || []), pick])], excluded: (edits.excluded || []).filter(x => x !== pick), ...(edits.order ? { order: [...edits.order.filter(x => x !== pick), pick] } : {}) });
              setPick('');
            }} style={{ ...button(T), opacity: pick ? 1 : 0.5 }}>{t('day.addTask')}</button>
          </div>
        )}
        <div style={row}>
          <span style={small}>{t('day.addPause').replace('+ ', '')}</span>
          <span style={small}>{t('day.pauseAt')}</span>
          <input type="time" name="pause-at" value={pauseAt} onChange={e => setPauseAt(e.target.value)} style={input(T, 92)} />
          <span style={small}>{t('day.pauseFor')}</span>
          <select name="pause-for" value={pauseFor} onChange={e => setPauseFor(e.target.value)} style={{ ...input(T, 64) }}>
            {['10', '15', '30', '45', '60'].map(m => <option key={m} value={m}>{fmtDuration(Number(m))}</option>)}
          </select>
          <button type="button" data-act="add-pause" onClick={() => {
            if (!pauseAt) return;
            const s = toMin(pauseAt);
            edit({ breaks: [...(edits.breaks || []), { start: s, end: Math.min(24 * 60, s + Number(pauseFor)) }].sort((a, b) => a.start - b.start) });
          }} style={button(T)}>{t('day.add')}</button>
        </div>
        <div style={row}>
          <span style={small}>{t('day.todayOnly')}</span>
          <input type="time" name="today-start" value={hours.start} onChange={e => e.target.value && edit({ hours: { ...(edits.hours || {}), start: e.target.value } })} style={input(T, 92)} />
          <span style={{ color: T.ink40 }}>–</span>
          <input type="time" name="today-end" value={hours.end} onChange={e => e.target.value && edit({ hours: { ...(edits.hours || {}), end: e.target.value } })} style={input(T, 92)} />
        </div>
        {edits.ungrouped && <button type="button" data-act="regroup" onClick={() => edit({ ungrouped: false })} style={button(T)}>{t('day.regroup')}</button>}
      </div>
      {excludedTasks.length > 0 && (
        <div data-not-today style={{ ...row, fontSize: 12.5 }}>
          <span style={{ ...small, fontWeight: 500 }}>{t('day.notToday')} :</span>
          {excludedTasks.map(x => (
            <span key={x.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 8px', borderRadius: T.rPill, border: `1px solid ${T.hairline}`, color: T.ink80 }}>
              {x.title}
              <button type="button" data-act="put-back" data-task={x.id} onClick={() => edit({ excluded: edits.excluded.filter(e => e !== x.id) })}
                style={{ fontSize: 11.5, color: T.accent, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: T.fontUI }}>{t('day.putBack')}</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

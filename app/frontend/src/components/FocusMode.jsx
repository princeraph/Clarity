import { useState, useEffect, useRef } from 'react';
import ApertureMark from './ApertureMark.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const SESSION_SECS = 25 * 60; // 25-minute pomodoro session
const R = 70;
const C = 2 * Math.PI * R;

function fmtTime(sec) {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function FocusMode({ task, nextTask, onDone, onSkip, onExit, onTimerStart, onTimerStop, onSubtaskToggle }) {
  const { t } = useLocale();
  const { T } = useTheme();

  // Elapsed seconds from when this component mounted (or from task.timerStarted)
  const startRef = useRef(
    task.timerStarted ? new Date(task.timerStarted).getTime() : Date.now()
  );
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - startRef.current) / 1000)
  );
  const [paused, setPaused] = useState(!task.timerStarted);
  const intervalRef = useRef(null);

  // Whether the *backend* timer is running. `paused` cannot answer this for the
  // unmount cleanup, which runs once and would close over the value from mount.
  const backendRunningRef = useRef(!!task.timerStarted);
  // The cleanup must not capture a stale task id or callback either.
  const latestRef = useRef(null);
  latestRef.current = { id: task.id, onTimerStop };

  function startBackendTimer() {
    if (backendRunningRef.current) return;
    backendRunningRef.current = true;
    onTimerStart?.(task.id);
  }

  function stopBackendTimer() {
    if (!backendRunningRef.current) return Promise.resolve();
    backendRunningRef.current = false;
    return Promise.resolve(onTimerStop?.(task.id));
  }

  useEffect(() => {
    if (!paused) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [paused]);

  // Start timer on mount only if not already running in the backend
  useEffect(() => {
    if (!task.timerStarted) {
      startRef.current = Date.now();
      setPaused(false);
      startBackendTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This component is keyed on the task id, so switching task — or leaving focus
  // mode at all — unmounts it. Nothing used to stop the backend timer here, so
  // the task you just left kept accruing time until something else stopped it.
  useEffect(() => () => {
    if (!backendRunningRef.current) return;
    backendRunningRef.current = false;
    const { id, onTimerStop: stop } = latestRef.current;
    stop?.(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggleTimer() {
    if (paused) {
      startBackendTimer();
      startRef.current = Date.now() - elapsed * 1000;
      setPaused(false);
    } else {
      stopBackendTimer();
      setPaused(true);
    }
  }

  // "Take a break" shared the toggle handler, so pressing it while already
  // paused restarted the timer — the opposite of taking a break. It only pauses.
  function handleBreak() {
    if (paused) return;
    stopBackendTimer();
    setPaused(true);
  }

  async function handleDone() {
    // Awaited: stopping is what converts timerStarted into tracked minutes, and
    // the done-write that follows reloads this task from the server.
    await stopBackendTimer();
    onDone?.(task);
  }

  const remaining = SESSION_SECS - elapsed;
  const progress = Math.min(elapsed / SESSION_SECS, 1);
  const overrun = elapsed > SESSION_SECS;

  const subtasks = task.subtasks || [];
  const firstActiveSub = subtasks.findIndex(s => !s.done);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: T.paper, color: T.ink,
      fontFamily: T.fontUI,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.hairlineSoft}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ApertureMark s={16} />
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink60 }}>{t('focusmode.title')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {nextTask && (
            <FMBtn label={t('focusmode.skipTask')} ghost T={T} onClick={onSkip} />
          )}
          <FMBtn label={t('focusmode.exitFocus')} ghost T={T} onClick={onExit} />
        </div>
      </div>

      {/* Central block */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40,
        maxWidth: 560, width: '100%', padding: '0 40px', textAlign: 'center',
      }}>
        {/* Progress ring + timer */}
        <div style={{ position: 'relative', width: 160, height: 160 }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="80" cy="80" r={R} fill="none" stroke={T.hairline} strokeWidth="6" />
            <circle cx="80" cy="80" r={R}
              fill="none"
              stroke={overrun ? T.warn : T.accent}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 28, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {overrun ? '+' : ''}{fmtTime(overrun ? elapsed - SESSION_SECS : remaining)}
            </span>
            <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, marginTop: 4 }}>
              {overrun ? t('focusmode.overSession') : t('focusmode.remaining')}
            </span>
          </div>
        </div>

        {/* Task */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.accentInk, padding: '3px 8px', background: T.accentSoft, borderRadius: 3 }}>{t('task.focus')}</span>
            {task.tags?.[0] && (
              <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>{task.tags[0]}</span>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: '-0.03em', color: T.ink, lineHeight: 1.2, textWrap: 'balance' }}>
            {task.title}
          </h1>
          {task.description && (
            <p style={{ margin: 0, fontSize: 14, color: T.ink60, lineHeight: 1.55 }}>
              {task.description}
            </p>
          )}
        </div>

        {/* Subtask list */}
        {subtasks.length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {subtasks.map((sub, i) => {
              const isActive = i === firstActiveSub;
              return (
                <div
                  key={sub.id}
                  onClick={() => onSubtaskToggle?.(task, sub.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 0', borderBottom: `1px solid ${T.hairlineSoft}`,
                    cursor: onSubtaskToggle ? 'pointer' : 'default',
                  }}
                >
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                    border: `1.5px solid ${sub.done ? T.done : isActive ? T.accent : T.ink40}`,
                    background: sub.done ? T.done : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sub.done && <span style={{ color: T.paper, fontSize: 8 }}>✓</span>}
                  </div>
                  <span style={{
                    fontSize: 13.5, flex: 1, textAlign: 'left',
                    color: sub.done ? T.ink40 : isActive ? T.ink : T.ink60,
                    textDecoration: sub.done ? 'line-through' : 'none',
                    fontWeight: isActive ? 500 : 400,
                  }}>{sub.title}</span>
                  {isActive && (
                    <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.accentInk, background: T.accentSoft, padding: '2px 6px', borderRadius: 3 }}>{t('focusmode.now')}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <FMBtn label={paused ? t('focusmode.resume') : t('focusmode.pause')} T={T} onClick={handleToggleTimer} />
          <FMBtn label={t('focusmode.done')} primary T={T} onClick={handleDone} />
          <FMBtn label={t('focusmode.takeABreak')} ghost T={T} onClick={handleBreak} />
        </div>
      </div>

      {/* Bottom: next up */}
      {nextTask && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '14px 24px',
          borderTop: `1px solid ${T.hairlineSoft}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40 }}>{t('focusmode.nextUp')}</span>
          <span style={{ fontSize: 13, color: T.ink60 }}>{nextTask.title}</span>
          {nextTask.tags?.[0] && (
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>{nextTask.tags[0]}</span>
          )}
        </div>
      )}
    </div>
  );
}

function FMBtn({ label, primary, ghost, onClick, T }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: T.fontUI, fontSize: 13, fontWeight: primary ? 500 : 400,
        padding: '9px 18px', borderRadius: T.r6, cursor: 'pointer',
        background: primary ? T.ink : ghost ? 'transparent' : hov ? T.paperMuted : T.paper,
        color: primary ? T.paper : ghost ? T.ink60 : T.ink,
        border: primary ? 'none' : ghost ? 'none' : `1px solid ${T.hairline}`,
        transition: 'background 0.1s',
      }}
    >{label}</button>
  );
}

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const DAY_START = 6;
const DAY_END   = 22;
const DAY_SPAN  = DAY_END - DAY_START;
const HOUR_MARKS = [6, 8, 10, 12, 14, 16, 18, 20];

const pct = h => ((h - DAY_START) / DAY_SPAN) * 100;
const dur = (s, e) => ((e - s) / DAY_SPAN) * 100;

function getBlockColors(T, isDark) {
  return {
    focus:   { bg: T.accentSoft, border: T.accent, label: T.accentInk },
    meeting: { bg: isDark ? 'oklch(0.30 0.07 65)' : 'oklch(0.94 0.05 65)',  border: T.warn, label: T.warn },
    away:    { bg: T.paperMuted, border: T.ink40,  label: T.ink60 },
  };
}

// "6a"/"2p" in English, "6 h"/"14 h" in French: the clock is part of the locale.
function fmtH(h, t) {
  return t(h >= 12 ? 'timeline.hourPm' : 'timeline.hourAm', { h, h12: h > 12 ? h - 12 : h });
}

function fmtHM(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h % 1) * 60);
  return `${hh}:${String(mm).padStart(2, '0')}`;
}

function nowHour() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color.border }} />
      {label}
    </span>
  );
}

export default function TimeBlockingStrip({ blocks = [] }) {
  const { t, fmtHours } = useLocale();
  const { T, isDark } = useTheme();
  const BLOCK_COLORS = getBlockColors(T, isDark);
  const [hovered, setHovered] = useState(null);

  const now = nowHour();
  const nowClamped = Math.max(DAY_START, Math.min(DAY_END, now));

  const focusBlocks   = blocks.filter(b => b.type === 'focus');
  const meetingBlocks = blocks.filter(b => b.type === 'meeting');
  const focusHours    = focusBlocks.reduce((acc, b) => acc + (b.end - b.start), 0);

  return (
    <div style={{
      padding: '12px 18px',
      background: T.paperSubtle,
      border: `1px solid ${T.hairline}`,
      borderRadius: T.r10,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40 }}>{t('timeline.title')}</span>
          <Legend color={BLOCK_COLORS.focus}   label={t('timeline.focus')} />
          <Legend color={BLOCK_COLORS.meeting} label={t('timeline.meeting')} />
          <Legend color={BLOCK_COLORS.away}    label={t('timeline.away')} />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontFamily: T.fontUI, fontSize: 11.5, color: T.ink60 }}>
          {focusHours > 0 ? (
            <span><span style={{ fontWeight: 500, color: T.ink }}>{fmtHours(focusHours * 60)}</span> {t('timeline.focusSuffix')}</span>
          ) : (
            <span style={{ color: T.ink40 }}>{t('timeline.noBlocks')}</span>
          )}
          {meetingBlocks.length > 0 && (
            <span><span style={{ fontWeight: 500, color: T.ink }}>{meetingBlocks.length}</span> {meetingBlocks.length === 1 ? t('timeline.meetingOne') : t('timeline.meetingMany')}</span>
          )}
        </div>
      </div>

      {/* Timeline bar */}
      <div style={{ position: 'relative', height: 28 }}>
        {/* Track background */}
        <div style={{
          position: 'absolute', inset: '8px 0',
          background: T.paperMuted, borderRadius: 4,
          overflow: 'hidden',
        }}>
          {blocks.map((b, i) => {
            if (b.type === 'free') return null;
            const c = BLOCK_COLORS[b.type];
            if (!c) return null;
            return (
              <div
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: 'absolute',
                  left: `${pct(b.start)}%`,
                  width: `${dur(b.start, b.end)}%`,
                  top: 0, bottom: 0,
                  background: c.bg,
                  borderLeft: `2px solid ${c.border}`,
                  cursor: 'default',
                  transition: 'filter 0.1s',
                  filter: hovered === i ? 'brightness(0.94)' : 'none',
                }}
              />
            );
          })}

          {/* NOW indicator */}
          {now >= DAY_START && now <= DAY_END && (
            <div style={{
              position: 'absolute',
              left: `${pct(nowClamped)}%`,
              top: 0, bottom: 0, width: 2,
              background: T.danger,
              zIndex: 2,
            }}>
              <div style={{
                position: 'absolute', top: -3, left: -3,
                width: 8, height: 8, borderRadius: '50%',
                background: T.danger,
              }} />
            </div>
          )}
        </div>

        {/* Hour marks */}
        {HOUR_MARKS.map(h => (
          <div key={h} style={{
            position: 'absolute',
            left: `${pct(h)}%`,
            top: 0,
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <div style={{ width: 1, height: 6, background: T.hairline }} />
            <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.ink40, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              {fmtH(h, t)}
            </span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hovered !== null && blocks[hovered] && blocks[hovered].type !== 'free' && (() => {
        const b = blocks[hovered];
        const c = BLOCK_COLORS[b.type];
        return (
          <div style={{
            marginTop: 8, padding: '6px 10px',
            background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: T.r6,
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c?.border, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 500 }}>{b.label}</span>
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>
              {fmtHM(b.start)} – {fmtHM(b.end)}
            </span>
          </div>
        );
      })()}
    </div>
  );
}

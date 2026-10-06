import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import ApertureMark from './ApertureMark.jsx';

// "Connect Clarity to Claude", shown instead of told: a ten-second loop in which
// a cursor clicks Connect in Clarity, then Install in Claude Desktop, then a
// question is asked and answered from the task list. Written for someone who
// has never heard the word "extension".
//
// Pure CSS animation — no image, no video, nothing fetched — so it works
// offline and every word in it goes through t(). Everything is drawn in a
// 520 × 292 design space and sized in cqw (a percentage of the scene's own
// width), so the whole scene scales with the card it sits in.
//
// Reduced motion: the same scenes, frozen at their key moment by pausing the
// very same animations at a negative delay, shown as a numbered sequence. One
// drawing, two ways of showing it — the frozen version cannot drift from the
// animated one.

const W = 520, H = 292, LOOP = 10; // design width, height, seconds

const c = n => `${(n / W * 100).toFixed(3)}cqw`;
const box = (x, y, w, h) => ({ position: 'absolute', left: c(x), top: c(y), width: c(w), height: c(h) });

// Keyframes that show an element inside [from, to] (in % of the loop) and hide
// it outside, with a short ramp. `hidden` is the transform applied while hidden.
function fade(name, intervals, { lo = 0, hidden = '' } = {}) {
  const r = 2;
  const off = `opacity:${lo};${hidden ? `transform:${hidden};` : ''}`;
  const on = `opacity:1;${hidden ? 'transform:none;' : ''}`;
  const inside = p => intervals.some(([a, b]) => p >= a && p <= b);
  const pts = [[0, inside(0)]];
  for (const [a, b] of intervals) {
    if (a > 0) pts.push([a - r, false], [a, true]);
    if (b < 100) pts.push([b, true], [b + r, false]);
  }
  pts.push([100, inside(100)]);
  pts.sort((p, q) => p[0] - q[0]);
  return `@keyframes ${name}{${pts.map(([p, v]) => `${p}%{${v ? on : off}}`).join('')}}`;
}

// The cursor's path: corner → Connect → Install → rest, then it leaves.
const P0 = [478, 282], P1 = [156, 139], P2 = [396, 199], P3 = [470, 262];
const at = ([x, y]) => `left:${(x / W * 100).toFixed(2)}%;top:${(y / H * 100).toFixed(2)}%;`;
const CURSOR = [
  [0, P0, 0, 1], [4, P0, 1, 1], [14, P1, 1, 1], [16, P1, 1, 0.8], [18, P1, 1, 1],
  [27, P1, 1, 1], [43, P2, 1, 1], [45, P2, 1, 0.8], [47, P2, 1, 1],
  [53, P3, 1, 1], [57, P3, 0, 1], [100, P3, 0, 1],
].map(([p, pt, o, s]) => `${p}%{${at(pt)}opacity:${o};transform:scale(${s})}`).join('');

const ripple = (name, p) => `@keyframes ${name}{0%,${p - 0.1}%{opacity:0;transform:translate(-50%,-50%) scale(.3)}` +
  `${p}%{opacity:.6;transform:translate(-50%,-50%) scale(.3)}${p + 6}%,100%{opacity:0;transform:translate(-50%,-50%) scale(1.6)}}`;

const press = (name, p, s) => `@keyframes ${name}{0%,${p - 0.1}%,${p + 2}%,100%{transform:scale(1)}${p}%{transform:scale(${s})}}`;
const rule = (selector, body) => `${selector}{${body}}`;

const CSS = [
  `@keyframes ca-cursor{${CURSOR}}`,
  ripple('ca-ripple1', 16), ripple('ca-ripple2', 45),
  press('ca-press1', 16, 0.96), press('ca-press2', 45, 0.94),
  fade('ca-ring', [[6, 17]]),
  fade('ca-connect', [[0, 17], [34, 100]]),
  fade('ca-preparing', [[19, 32]]),
  fade('ca-window', [[26, 95]], { hidden: 'translateY(2%) scale(.97)' }),
  fade('ca-dialog', [[0, 54], [99, 100]]),
  fade('ca-ask', [[0, 47], [99, 100]]),
  fade('ca-done', [[49, 54]]),
  fade('ca-question', [[61, 100]], { hidden: 'translateY(30%)' }),
  fade('ca-typing', [[65, 68]]),
  fade('ca-tool', [[70, 100]]),
  fade('ca-intro', [[73, 100]]),
  fade('ca-task1', [[76, 100]], { hidden: 'translateY(20%)' }),
  fade('ca-task2', [[79, 100]], { hidden: 'translateY(20%)' }),
  fade('ca-step1', [[0, 24], [98, 100]], { lo: 0.45 }),
  fade('ca-step2', [[26, 57]], { lo: 0.45 }),
  fade('ca-step3', [[59, 96]], { lo: 0.45 }),
  fade('ca-bar1', [[0, 24], [98, 100]]),
  fade('ca-bar2', [[26, 57]]),
  fade('ca-bar3', [[59, 96]]),
  '@keyframes ca-dot{0%,100%{opacity:.3}50%{opacity:1}}',
  rule('.ca-mark svg', 'width:100%;height:100%;display:block'),
  // Frozen: every animation paused at the same instant, set per stage.
  rule('.ca-frozen,.ca-frozen *', 'animation-play-state:paused!important;animation-delay:var(--ca-at)!important'),
].join('\n');

const anim = (name, ease = 'ease-in-out') => ({ animation: `${name} ${LOOP}s ${ease} infinite` });

// Key moments, in seconds, shown when motion is reduced.
const FROZEN = [1.5, 4.4, 9.2];
const STEP_KEYS = ['connectorAnim.step1', 'connectorAnim.step2', 'connectorAnim.step3'];

function Bars({ T, x, y, widths, gap = 10, h = 5, color }) {
  return widths.map((w, i) => (
    <div key={i} style={{ ...box(x, y + i * gap, w, h), borderRadius: c(3), background: color || T.ink20, opacity: 0.6 }} />
  ));
}

function TitleBar({ T, label, mark }) {
  return (
    <div style={{
      ...box(0, 0, 0, 24), width: '100%', display: 'flex', alignItems: 'center', gap: c(6),
      padding: `0 ${c(9)}`, boxSizing: 'border-box',
      background: T.paperSubtle, borderBottom: `1px solid ${T.hairline}`,
    }}>
      {mark
        ? <span className="ca-mark" style={{ width: c(11), height: c(11) }}><ApertureMark s={12} /></span>
        : <span style={{ width: c(9), height: c(9), borderRadius: '50%', background: T.ink40 }} />}
      <span style={{ fontSize: c(10), fontWeight: 600, color: T.ink80 }}>{label}</span>
      <span style={{ flex: 1 }} />
      {/* Minimise, maximise, close — drawn, not written. */}
      <span style={{ width: c(8), height: c(1.5), background: T.ink40, marginLeft: c(6) }} />
      <span style={{ width: c(7), height: c(7), border: `1px solid ${T.ink40}`, marginLeft: c(8), boxSizing: 'border-box' }} />
      <svg viewBox="0 0 8 8" style={{ width: c(7), height: c(7), marginLeft: c(8), display: 'block' }}>
        <path d="M1 1 L7 7 M7 1 L1 7" stroke={T.ink40} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Stage({ T, t, frozenAt }) {
  const windowStyle = {
    borderRadius: c(9), overflow: 'hidden', background: T.paper,
    border: `1px solid ${T.hairline}`, boxShadow: '0 6px 22px rgba(0,0,0,0.10)',
  };
  return (
    <div
      className={frozenAt != null ? 'ca-frozen' : undefined}
      aria-hidden="true"
      style={{
        containerType: 'inline-size', position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`,
        overflow: 'hidden', borderRadius: T.r10, background: T.paperMuted,
        border: `1px solid ${T.hairlineSoft}`, fontFamily: T.fontUI, color: T.ink, lineHeight: 1.35,
        userSelect: 'none', ...(frozenAt != null ? { '--ca-at': `-${frozenAt}s` } : {}),
      }}
    >
      {/* 1 — Clarity, Settings → AI */}
      <div style={{ ...box(22, 18, 352, 248), ...windowStyle }}>
        <TitleBar T={T} label="Clarity" mark />
        <div style={{ ...box(0, 24, 78, 224), background: T.paperSubtle, borderRight: `1px solid ${T.hairlineSoft}` }}>
          <Bars T={T} x={12} y={14} widths={[46, 38, 50, 34]} gap={16} />
          <div style={{ ...box(6, 76, 66, 14), borderRadius: c(4), background: T.accentSoft }} />
          <div style={{ ...box(12, 81, 40, 5), borderRadius: c(3), background: T.accent, opacity: 0.7 }} />
        </div>
        <div style={{ ...box(94, 36, 240, 12), fontFamily: T.fontMono, fontSize: c(8), letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink60 }}>
          {t('settings.section.ai')}
        </div>
        <div style={{ ...box(94, 52, 240, 16), fontSize: c(12), fontWeight: 600, whiteSpace: 'nowrap' }}>
          {t('settings.connector.title')}
        </div>
        <Bars T={T} x={94} y={76} widths={[226, 168]} />
        <div style={{ position: 'absolute', left: c(94), top: c(106), ...anim('ca-press1') }}>
          <div style={{
            position: 'absolute', inset: c(-4), borderRadius: c(9),
            border: `${c(2)} solid ${T.accent}`, ...anim('ca-ring'),
          }} />
          <div style={{
            display: 'grid', alignItems: 'center', height: c(28), padding: `0 ${c(13)}`,
            borderRadius: c(6), background: T.ink, color: T.paper, fontSize: c(10.5), fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            <span style={{ gridArea: '1 / 1', ...anim('ca-connect') }}>{t('settings.connector.connect')}</span>
            <span style={{ gridArea: '1 / 1', ...anim('ca-preparing') }}>{t('settings.connector.preparing')}</span>
          </div>
        </div>
        <Bars T={T} x={94} y={148} widths={[200, 140]} />
        <div style={{ ...box(94, 180, 240, 52), borderRadius: c(6), border: `1px solid ${T.hairline}` }} />
        <Bars T={T} x={106} y={192} widths={[150, 110, 130]} />
      </div>

      {/* 2 and 3 — Claude Desktop: the install dialog, then the conversation */}
      <div style={{ ...box(150, 34, 350, 244), ...windowStyle, background: T.panel, ...anim('ca-window') }}>
        <TitleBar T={T} label={t('connectorAnim.claudeDesktop')} />

        <div style={{ ...box(0, 24, 350, 220) }}>
          <div style={{
            position: 'absolute', right: c(16), top: c(16), maxWidth: c(232),
            padding: `${c(7)} ${c(10)}`, borderRadius: c(10), background: T.paperMuted,
            fontSize: c(10), ...anim('ca-question'),
          }}>{t('connectorAnim.question')}</div>

          <div style={{ ...box(16, 70, 40, 10), display: 'flex', gap: c(4), ...anim('ca-typing') }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: c(5), height: c(5), borderRadius: '50%', background: T.ink40, animation: `ca-dot 0.9s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>
          <div style={{
            position: 'absolute', left: c(16), top: c(64), display: 'flex', alignItems: 'center', gap: c(5),
            padding: `${c(3)} ${c(8)} ${c(3)} ${c(5)}`, borderRadius: c(20),
            background: T.paperSubtle, border: `1px solid ${T.hairline}`,
            fontSize: c(8.5), fontWeight: 500, color: T.ink80, ...anim('ca-tool'),
          }}>
            <span className="ca-mark" style={{ width: c(10), height: c(10) }}><ApertureMark s={10} /></span>
            Clarity
          </div>
          <div style={{ ...box(16, 90, 318, 14), fontSize: c(10), ...anim('ca-intro') }}>{t('connectorAnim.answerIntro')}</div>
          {['connectorAnim.task1', 'connectorAnim.task2'].map((k, i) => (
            <div key={k} style={{
              ...box(16, 110 + i * 24, 300, 20), display: 'flex', alignItems: 'center', gap: c(7),
              padding: `0 ${c(8)}`, boxSizing: 'border-box', borderRadius: c(6),
              background: T.paperSubtle, border: `1px solid ${T.hairlineSoft}`,
              fontSize: c(9.5), whiteSpace: 'nowrap', ...anim(i ? 'ca-task2' : 'ca-task1'),
            }}>
              <span style={{ width: c(8), height: c(8), borderRadius: '50%', border: `${c(1.3)} solid ${T.accent}`, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: T.accentInk }}>{i + 1}.</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(k)}</span>
            </div>
          ))}
          <div style={{ ...box(16, 184, 318, 26), borderRadius: c(13), border: `1px solid ${T.hairline}`, background: T.paper }} />
          <div style={{ ...box(30, 195, 120, 5), borderRadius: c(3), background: T.ink20 }} />

          {/* The install dialog, over a dimmed window */}
          <div style={{ position: 'absolute', inset: 0, ...anim('ca-dialog') }}>
            <div style={{ position: 'absolute', inset: 0, background: T.ink20 }} />
            <div style={{
              ...box(60, 22, 230, 140), borderRadius: c(10), background: T.paper,
              border: `1px solid ${T.hairline}`, boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
            }}>
              <div style={{ position: 'absolute', inset: 0, ...anim('ca-ask') }}>
                <div className="ca-mark" style={{ ...box(14, 14, 24, 24), padding: c(3), boxSizing: 'border-box', borderRadius: c(6), background: T.paperSubtle, border: `1px solid ${T.hairline}` }}>
                  <ApertureMark s={18} />
                </div>
                <div style={{ ...box(46, 18, 170, 16), fontSize: c(11.5), fontWeight: 600 }}>{t('connectorAnim.installTitle')}</div>
                <div style={{ ...box(14, 48, 202, 40), fontSize: c(9.5), color: T.ink60 }}>{t('connectorAnim.installBody')}</div>
                <div style={{
                  ...box(98, 104, 52, 22), display: 'grid', placeItems: 'center', borderRadius: c(6),
                  border: `1px solid ${T.hairline}`, fontSize: c(9.5), color: T.ink80,
                }}>{t('common.cancel')}</div>
                <div style={{
                  ...box(156, 104, 60, 22), display: 'grid', placeItems: 'center', borderRadius: c(6),
                  background: T.accent, color: '#fff', fontSize: c(9.5), fontWeight: 600, ...anim('ca-press2'),
                }}>{t('connectorAnim.install')}</div>
              </div>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: c(8), ...anim('ca-done'),
              }}>
                <div style={{
                  width: c(28), height: c(28), borderRadius: '50%', display: 'grid', placeItems: 'center',
                  background: T.successSoft, color: T.success, fontSize: c(15), fontWeight: 700,
                }}>✓</div>
                <div style={{ fontSize: c(11), fontWeight: 600 }}>{t('connectorAnim.installed')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The cursor and its clicks */}
      {[['ca-ripple1', P1], ['ca-ripple2', P2]].map(([name, [x, y]]) => (
        <div key={name} style={{
          position: 'absolute', left: c(x), top: c(y), width: c(30), height: c(30), borderRadius: '50%',
          border: `${c(2.5)} solid ${T.accent}`, opacity: 0, ...anim(name, 'ease-out'),
        }} />
      ))}
      <div style={{ position: 'absolute', width: c(16), height: c(22), transformOrigin: '0 0', ...anim('ca-cursor') }}>
        <svg viewBox="0 0 16 22" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
          <path d="M1 1 L1 17 L5 13.2 L8 20 L10.8 18.8 L7.9 12.2 L13.2 12.2 Z"
            fill="#FFFFFF" stroke="#19191A" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduce, setReduce] = useState(() => {
    try { return window.matchMedia(query).matches; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia(query); } catch { return undefined; }
    const onChange = e => setReduce(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

export default function ConnectorAnimation({ defaultOpen = true }) {
  const { T } = useTheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();

  const number = (n, active) => (
    <span style={{
      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
      fontSize: 10.5, fontWeight: 600, fontFamily: T.fontMono,
      background: active ? T.accent : T.paperMuted, color: active ? '#fff' : T.ink60,
    }}>{n}</span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{CSS}</style>
      <div>
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{
          padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 12.5, color: T.ink60, fontFamily: T.fontUI,
        }}>{open ? '▾' : '▸'} {t('connectorAnim.toggle')}</button>
      </div>

      {open && (reduce ? (
        <ol aria-label={t('connectorAnim.alt')} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
          {STEP_KEYS.map((k, i) => (
            <li key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.ink }}>
                {number(i + 1, true)}{t(k)}
              </div>
              <Stage T={T} t={t} frozenAt={FROZEN[i]} />
            </li>
          ))}
        </ol>
      ) : (
        <div role="img" aria-label={t('connectorAnim.alt')} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
          <Stage T={T} t={t} />
          <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {STEP_KEYS.map((k, i) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 2, borderRadius: 2, background: T.hairline, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: T.accent, ...anim(`ca-bar${i + 1}`) }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: T.ink, lineHeight: 1.35, ...anim(`ca-step${i + 1}`) }}>
                  {number(i + 1, false)}<span style={{ paddingTop: 1 }}>{t(k)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

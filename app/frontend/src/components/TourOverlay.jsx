import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

// The guided tour (tour/tours.js). One lit rectangle that glides from element
// to element over a dimmed window, and a card beside it. Each step first
// moves Clarity where its element lives (`onStep`), then finds the element by
// `data-tour` — waiting for the view to fade in — and follows it if the
// window is resized or the page scrolls.

const SCRIM = 'rgba(15,15,18,0.58)';
const CARD = '#19191A';          // dark in both themes, as the first tutorial
const CARD_TEXT = '#FAFAF7';
const CARD_W = 320;
const GAP = 14;                  // between the lit element and the card
const PAD = 6;                   // light around the element
const FIND_FOR_MS = 1500;        // how long a step waits for its element

function findTarget(name) {
  if (!name) return null;
  const el = document.querySelector(`[data-tour="${name}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

function rectOf(el) {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  // A long list is taller than the window: light only what can be seen.
  const top = Math.max(r.top - PAD, 4), left = Math.max(r.left - PAD, 4);
  const bottom = Math.min(r.bottom + PAD, vh - 4), right = Math.min(r.right + PAD, vw - 4);
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}

// Right of the element if it fits, else below, above, left — else over it.
function placeCard(rect, cardH) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const clampY = y => Math.min(Math.max(y, 12), vh - cardH - 12);
  const clampX = x => Math.min(Math.max(x, 12), vw - CARD_W - 12);
  if (!rect) return { top: (vh - cardH) / 2, left: (vw - CARD_W) / 2 };
  if (rect.left + rect.width + GAP + CARD_W <= vw - 12)
    return { top: clampY(rect.top), left: rect.left + rect.width + GAP };
  if (rect.top + rect.height + GAP + cardH <= vh - 12)
    return { top: rect.top + rect.height + GAP, left: clampX(rect.left) };
  if (rect.top - GAP - cardH >= 12)
    return { top: rect.top - GAP - cardH, left: clampX(rect.left) };
  if (rect.left - GAP - CARD_W >= 12)
    return { top: clampY(rect.top), left: rect.left - GAP - CARD_W };
  return { top: clampY(rect.top + rect.height - cardH - 12), left: clampX(rect.left + 12) };
}

export default function TourOverlay({ steps, onStep, onDone, label }) {
  const { T } = useTheme();
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);        // null: a card in the middle
  const [ready, setReady] = useState(false);     // element found (or given up)
  const [cardH, setCardH] = useState(200);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const dirRef = useRef(1);                      // skipping goes the way we were going
  const elRef = useRef(null);

  const step = steps[index];
  const total = steps.length;
  const last = index === total - 1;

  function go(to) {
    dirRef.current = to < index ? -1 : 1;
    if (to < 0) return;
    if (to >= total) { onDone?.(true); return; }
    setReady(false);
    setIndex(to);
  }
  const finish = () => onDone?.(index === total - 1);

  // Move Clarity to the step's place, then look for its element.
  useEffect(() => {
    if (!step) return undefined;
    let live = true;
    elRef.current = null;
    onStep?.(step);
    if (!step.target) { setRect(null); setReady(true); return undefined; }
    const started = performance.now();
    let frame;
    let lastRect = null, stableFor = 0;
    const look = () => {
      if (!live) return;
      const el = findTarget(step.target);
      if (el) {
        el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        const r = rectOf(el);
        // Wait for the view's fade-in to settle: a rect measured mid-motion
        // would be off by the few pixels it still has to travel.
        const same = lastRect && Math.abs(r.top - lastRect.top) < 0.5 && Math.abs(r.left - lastRect.left) < 0.5
          && Math.abs(r.width - lastRect.width) < 0.5 && Math.abs(r.height - lastRect.height) < 0.5;
        stableFor = same ? stableFor + 1 : 0;
        lastRect = r;
        if (stableFor >= 3) { elRef.current = el; setRect(r); setReady(true); return; }
      }
      if (performance.now() - started > FIND_FOR_MS) {
        if (el) { elRef.current = el; setRect(rectOf(el)); setReady(true); return; }
        if (step.optional) { go(index + dirRef.current); return; }
        setRect(null); setReady(true);            // not on screen: say it in the middle
        return;
      }
      frame = requestAnimationFrame(look);
    };
    frame = requestAnimationFrame(look);
    return () => { live = false; cancelAnimationFrame(frame); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Follow the element: window resized, page scrolled, element grew.
  useEffect(() => {
    if (!ready || !elRef.current) return undefined;
    const el = elRef.current;
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { if (el.isConnected) setRect(rectOf(el)); });
    };
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(remeasure) : null;
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
      ro?.disconnect();
    };
  }, [ready, index]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, ready, rect]);

  useEffect(() => { if (ready) nextRef.current?.focus(); }, [ready, index]);

  // The tour has the keyboard: arrows move, Escape leaves. Capture phase, so
  // the views underneath do not also act on the same keys.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(index + 1); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); e.stopPropagation(); go(index - 1); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  if (!step) return null;
  const pos = placeCard(rect, cardH);
  const lit = rect || { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 };

  return (
    <div data-testid="tour" data-step={step.key} data-ready={ready ? '1' : '0'} data-target={ready && rect ? step.target : ''} style={{ position: 'fixed', inset: 0, zIndex: 500, fontFamily: T.fontUI }}
      onMouseDown={e => e.preventDefault()}>
      {/* The lit rectangle: its shadow is the dimmed window around it. It
          glides from one element to the next instead of jumping. */}
      <div aria-hidden="true" className="clarity-tour-spot" style={{
        position: 'fixed', top: lit.top, left: lit.left, width: lit.width, height: lit.height,
        borderRadius: rect ? 10 : 0,
        boxShadow: `0 0 0 9999px ${SCRIM}${rect ? `, 0 0 0 2px ${T.accent}` : ''}`,
        transition: 'top .38s cubic-bezier(.2,.7,.2,1), left .38s cubic-bezier(.2,.7,.2,1), width .38s cubic-bezier(.2,.7,.2,1), height .38s cubic-bezier(.2,.7,.2,1), border-radius .38s',
        pointerEvents: 'none',
      }}>
        {rect && <span className="clarity-tour-ring" style={{ position: 'absolute', inset: -2, borderRadius: 12, border: `2px solid ${T.accent}` }} />}
      </div>

      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body"
        key={index} className="clarity-pop"
        style={{
          position: 'fixed', top: pos.top, left: pos.left, width: CARD_W,
          background: CARD, color: CARD_TEXT,
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: T.r10,
          padding: '18px 20px', boxShadow: '0 12px 40px rgba(0,0,0,0.32)',
          opacity: ready ? 1 : 0, transition: 'opacity .15s ease',
          boxSizing: 'border-box',
        }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 12, alignItems: 'center' }}>
          {steps.map((_, i) => (
            <span key={i} style={{
              width: i === index ? 18 : 5, height: 3, borderRadius: 2,
              background: i === index ? T.accent : i < index ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)',
              transition: 'width .2s ease, background-color .2s ease',
            }} />
          ))}
          <span style={{ fontFamily: T.fontMono, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', letterSpacing: '0.06em' }}>
            {label ? `${label} · ` : ''}{index + 1} / {total}
          </span>
        </div>

        <h3 id="tour-title" style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, letterSpacing: '-0.02em', color: CARD_TEXT }}>
          {t(step.titleKey)}
        </h3>
        <p id="tour-body" style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
          {t(step.bodyKey)}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={finish} style={{ fontFamily: T.fontUI, fontSize: 12, color: 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginRight: 'auto' }}>
            {last ? t('tour.close') : t('tour.skip')}
          </button>
          {index > 0 && (
            <button onClick={() => go(index - 1)} style={{ fontFamily: T.fontUI, fontSize: 13, color: CARD_TEXT, background: 'rgba(255,255,255,0.08)', border: 'none', padding: '7px 12px', borderRadius: T.r6, cursor: 'pointer' }}>
              {t('tour.back')}
            </button>
          )}
          <button ref={nextRef} onClick={() => go(index + 1)} style={{ fontFamily: T.fontUI, fontSize: 13, fontWeight: 500, color: CARD, background: CARD_TEXT, border: 'none', padding: '7px 14px', borderRadius: T.r6, cursor: 'pointer' }}>
            {last ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

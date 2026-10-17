import { useLayoutEffect, useRef, useState } from 'react';

// A list of tasks that can be put in order by hand (2.4.0): drag a card up or
// down (from anywhere but its buttons), or Alt + ↑ / ↓ on a focused card.
// The others make room as it moves; when the order changes — by hand or not —
// each card slides from where it was to where it lands (FLIP), unless the
// system asks for less motion. What a drop means (rank, level) is decided by
// lib/ordre.js's dropPlan, through `onMove(id, toIndex)`.

const INTERACTIVE = 'button, a, input, select, textarea, [data-check], [contenteditable="true"]';
const between = (i, lo, hi) => lo <= hi && i >= lo && hi >= i;
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function SortableList({ items, render, onMove, gap = 0, testId }) {
  const box = useRef(null);
  const tops = useRef(new Map());
  const drag = useRef(null);
  const [state, setState] = useState(null);   // { id, from, to, dy, h }
  const justDragged = useRef(false);

  // FLIP: where each card was, where it is now; slide the difference away.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const now = new Map();
    for (const c of el.children) if (c.dataset.sortId) now.set(c.dataset.sortId, c.getBoundingClientRect().top);
    if (!drag.current && !reduced()) {
      for (const c of el.children) {
        const before = tops.current.get(c.dataset.sortId), after = now.get(c.dataset.sortId);
        if (before == null || after == null || Math.abs(before - after) < 2) continue;
        c.style.transition = 'none';
        c.style.transform = `translateY(${before - after}px)`;
        requestAnimationFrame(() => { c.style.transition = 'transform 0.28s cubic-bezier(.2,.7,.2,1)'; c.style.transform = ''; });
      }
    }
    tops.current = now;
  });

  const ids = items.map(t => t.id);
  const indexAt = (y, d) => {
    // Where the dragged card's middle is, among the others' middles.
    const mid = d.mids;
    let k = 0;
    while (k < mid.length && y > mid[k]) k++;
    return k;
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 || !onMove || e.target.closest(INTERACTIVE)) return;
    const card = e.target.closest('[data-sort-id]');
    if (!card || card.parentElement !== box.current) return;
    const id = card.dataset.sortId;
    const rects = [...box.current.children].map(c => c.getBoundingClientRect());
    const from = ids.indexOf(id);
    drag.current = { id, from, y0: e.clientY, moved: false, h: rects[from].height + gap,
      top0: rects[from].top, mids: rects.filter((_, i) => i !== from).map(r => r.top + r.height / 2) };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dy) < 6) return;
    if (!d.moved) { d.moved = true; box.current.setPointerCapture?.(e.pointerId); }
    const to = indexAt(d.top0 + dy + (d.h - gap) / 2, d);
    setState({ id: d.id, from: d.from, to, dy, h: d.h });
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    setState(null);
    if (d?.moved) {
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 0);
      const to = state?.id === d.id ? state.to : d.from;
      if (to !== d.from) onMove(d.id, to);
    }
  };
  const onKeyDown = (e) => {
    if (!onMove || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const card = e.target.closest('[data-sort-id]');
    if (!card) return;
    const from = ids.indexOf(card.dataset.sortId);
    const to = from + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= ids.length) return;
    e.preventDefault(); e.stopPropagation();
    onMove(card.dataset.sortId, to);
    // Back on the same card once the list has moved.
    const id = card.dataset.sortId;
    setTimeout(() => box.current?.querySelector(`[data-sort-id="${id}"] [data-task-id]`)?.focus(), 400);
  };

  return (
    <div ref={box} role="list" data-sortable={testId || ''} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={end} onPointerCancel={end} onKeyDown={onKeyDown}
      onClickCapture={(e) => { if (justDragged.current) { e.stopPropagation(); e.preventDefault(); } }}
      style={{ display: 'flex', flexDirection: 'column', gap, touchAction: state ? 'none' : 'auto' }}>
      {items.map((task, i) => {
        let ty = 0;
        if (state) {
          if (task.id === state.id) ty = state.dy;
          // The cards between where it was and where it goes make room for it.
          else if (between(i, state.from + 1, state.to)) ty = -state.h;
          else if (between(i, state.to, state.from - 1)) ty = state.h;
        }
        const dragging = state?.id === task.id;
        return (
          <div key={task.id} role="listitem" data-sort-id={task.id} data-dragging={dragging ? '' : undefined} style={{
            transform: ty ? `translateY(${ty}px)` : undefined,
            transition: state && !dragging ? 'transform 0.18s ease' : undefined,
            position: 'relative', zIndex: dragging ? 5 : undefined,
            boxShadow: dragging ? '0 10px 26px rgba(0,0,0,0.16)' : undefined,
            borderRadius: dragging ? 8 : undefined, cursor: onMove ? (dragging ? 'grabbing' : 'grab') : undefined,
            userSelect: state ? 'none' : undefined,
          }}>
            {render(task)}
          </div>
        );
      })}
    </div>
  );
}

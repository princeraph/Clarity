import { useRef } from 'react';

// Click-outside-to-close for a modal backdrop, without the trap it used to have.
//
// A click is dispatched to the nearest common ancestor of where the button went
// down and where it came up. Press inside a text field, drag to select, release
// past the box's edge: that ancestor is the backdrop, so `e.target ===
// e.currentTarget` held and the box closed — taking the half-typed task with it.
// Close only when the press ALSO started on the backdrop.
export function useBackdropClose(onClose) {
  const downOnBackdrop = useRef(false);
  return {
    onMouseDown: e => { downOnBackdrop.current = true; },
    onClick: e => {
      const close = downOnBackdrop.current && e.target === e.currentTarget;
      downOnBackdrop.current = false;
      if (close) onClose?.();
    },
  };
}

// The logic of useBackdropClose, kept free of React so it can be checked by a
// plain script (tools/verifier-fond.mjs, in the quality gate).
//
// A click is dispatched to the nearest common ancestor of where the button went
// down and where it came up. Press inside a text field, drag to select, release
// past the box's edge: that ancestor is the backdrop. Close only when the press
// ALSO started on the backdrop itself.
export function createBackdropHandlers(getOnClose, ref = { current: false }) {
  return {
    onMouseDown: e => { ref.current = e.target === e.currentTarget; },
    onClick: e => {
      const close = ref.current && e.target === e.currentTarget;
      ref.current = false;
      if (close) getOnClose()?.();
    },
  };
}

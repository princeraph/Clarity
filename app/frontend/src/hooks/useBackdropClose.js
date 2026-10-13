import { useRef } from 'react';
import { createBackdropHandlers } from './backdropHandlers.js';

// Click-outside-to-close for a modal backdrop, without closing when a text
// selection merely ends outside the box (see backdropHandlers.js).
export function useBackdropClose(onClose) {
  const downOnBackdrop = useRef(false);
  const latest = useRef(onClose);
  latest.current = onClose;
  return createBackdropHandlers(() => latest.current, downOnBackdrop);
}

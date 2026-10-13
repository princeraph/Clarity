import { useEffect, useRef } from 'react';

// Escape closes the panel on top, and only that one. Panels that stack (the
// chat over a task's details) register in order; the last one opened answers.
// A dialog or field that already handled Escape (preventDefault, or a
// capture-phase dialog that stops it) is left alone.
const stack = [];

function onKey(e) {
  if (e.key !== 'Escape' || e.defaultPrevented || !stack.length) return;
  e.preventDefault();
  stack[stack.length - 1].current?.();
}

export default function useEscape(onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!stack.length) window.addEventListener('keydown', onKey);
    stack.push(ref);
    return () => {
      const i = stack.lastIndexOf(ref);
      if (i !== -1) stack.splice(i, 1);
      if (!stack.length) window.removeEventListener('keydown', onKey);
    };
  }, []);
}

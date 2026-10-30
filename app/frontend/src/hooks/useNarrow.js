import { useEffect, useState } from 'react';

// Below this width the task and its subtask (600 + 380 px, side by side in
// one centred window since lot E1) no longer fit with a margin. There the
// subtask takes the task's place in the window, with the way back above it.
export const NARROW_BELOW = 1100;
const QUERY = `(max-width: ${NARROW_BELOW - 1}px)`;

export default function useNarrow() {
  const [narrow, setNarrow] = useState(() => { try { return window.matchMedia(QUERY).matches; } catch { return false; } });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia(QUERY); } catch { return undefined; }
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

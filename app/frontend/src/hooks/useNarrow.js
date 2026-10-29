import { useEffect, useState } from 'react';

// Below this width the task's page and its subtask's page (360 px each) no
// longer fit beside the list: side by side they would eat it whole. There the
// subtask's page goes over the task's instead (2.10.0).
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

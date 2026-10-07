import { useState, useEffect } from 'react';

// The built-in assistant's download, as the sidebar and the "AI unavailable"
// card show it. A new tester's first minutes used to read "AI offline" in
// orange while the assistant was downloading, as if something had broken.

const ACTIVE = ['resuming', 'downloading', 'verifying'];

/** 0–100 while a download is under way, else null. Asked only while `active`. */
export function useAssistantDownload(active) {
  const [percent, setPercent] = useState(null);
  useEffect(() => {
    if (!active) { setPercent(null); return undefined; }
    let live = true;
    const ask = () => fetch('http://localhost:3001/api/assistant').then(r => (r.ok ? r.json() : null)).then(b => {
      if (!live) return;
      const d = b?.download;
      setPercent(d && ACTIVE.includes(d.state) && d.total ? Math.floor((d.received / d.total) * 100) : null);
    }).catch(() => {});
    ask();
    const id = setInterval(ask, 3000);
    return () => { live = false; clearInterval(id); };
  }, [active]);
  return percent;
}

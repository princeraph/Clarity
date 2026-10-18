import { useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';

// Settings › Data › Import (2.5.0): a file from elsewhere — a Clarity export,
// a Todoist CSV, any CSV with a title column, or a plain list — previewed
// first (how many, the first ones, what is already there), then imported.
// The reading is the server's (backend/src/importer.js).
const API = 'http://localhost:3001/api';
const MAX_BYTES = 5 * 1024 * 1024;

export default function ImportTasks({ T, onImported }) {
  const { t, fmtDate } = useLocale();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [preview, setPreview] = useState(null);
  const [state, setState] = useState('idle');   // idle | reading | ready | importing | done | error
  const [message, setMessage] = useState('');
  const post = (path) => fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });

  async function pick(file) {
    setPreview(null); setMessage(''); setName(file?.name || '');
    if (!file) return;
    if (file.size > MAX_BYTES) { setState('error'); setMessage(t('import.tooBig')); return; }
    setState('reading');
    const content = await file.text();
    setText(content);
    try {
      const r = await fetch(`${API}/import/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: content }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.code);
      setPreview(body); setState('ready');
    } catch (e) { setState('error'); setMessage(t(e.message === 'import-empty' ? 'import.empty' : 'import.failed')); }
  }
  async function run() {
    setState('importing');
    try {
      const r = await post('/import');
      const body = await r.json();
      if (!r.ok) throw new Error();
      setState('done'); setMessage(t(body.imported === 1 ? 'import.doneOne' : 'import.done', { n: body.imported }));
      setPreview(null); onImported?.();
    } catch { setState('error'); setMessage(t('import.failed')); }
  }
  const btn = (primary) => ({ padding: '6px 12px', fontSize: 12.5, fontFamily: T.fontUI, borderRadius: T.r6, cursor: 'pointer',
    ...(primary ? { background: T.ink, color: T.paper, border: 'none' } : { background: 'transparent', color: T.ink80, border: `1px solid ${T.hairline}` }) });

  return (
    <div data-import style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ ...btn(false), alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {t('import.pick')}
        <input type="file" name="import-file" accept=".json,.csv,.txt,.md,text/plain,text/csv,application/json"
          onChange={e => pick(e.target.files?.[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      </label>
      {state === 'reading' && <div style={{ fontSize: 12.5, color: T.ink60 }}>{t('import.reading')}</div>}
      {preview && (
        <div data-import-preview style={{ border: `1px solid ${T.hairline}`, borderRadius: T.r10, padding: '12px 14px', background: T.paper }}>
          <div style={{ fontSize: 13, color: T.ink }}>
            <strong>{name}</strong> · {t(`import.format.${preview.format}`)} · {t(preview.count === 1 ? 'import.countOne' : 'import.count', { n: preview.count })}
            {preview.skipped > 0 && <span style={{ color: T.ink60 }}> · {t('import.skipped', { n: preview.skipped })}</span>}
          </div>
          {preview.tooMany && <div style={{ fontSize: 12, color: T.warn, marginTop: 4 }}>{t('import.tooMany')}</div>}
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: T.ink80 }}>
            {preview.sample.map((s, i) => <li key={i}>{s.title}{s.deadline ? ` — ${fmtDate(s.deadline + 'T00:00:00', { day: 'numeric', month: 'short' })}` : ''}{s.status === 'done' ? ` ✓` : ''}</li>)}
          </ul>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" data-act="import" disabled={!preview.count || state === 'importing'} onClick={run} style={{ ...btn(true), opacity: preview.count ? 1 : 0.5 }}>
              {t(preview.count === 1 ? 'import.runOne' : 'import.run', { n: preview.count })}
            </button>
            <button type="button" onClick={() => { setPreview(null); setState('idle'); }} style={btn(false)}>{t('import.cancel')}</button>
          </div>
        </div>
      )}
      {message && <div role={state === 'error' ? 'alert' : 'status'} data-import-result style={{ fontSize: 12.5, color: state === 'error' ? T.warn : T.done }}>{message}</div>}
    </div>
  );
}

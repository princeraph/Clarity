import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';

const STATE_KEY = {
  open: 'thread.state.open', blocked: 'thread.state.blocked', moving: 'thread.state.moving',
  parked: 'thread.state.parked', resolved: 'thread.state.resolved',
};

function daysSince(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function Label({ children, T }) {
  return (
    <div style={{
      fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: T.ink40, marginBottom: 8,
    }}>{children}</div>
  );
}

function Row({ children, T }) {
  return <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>;
}

function Btn({ children, onClick, disabled, tone = 'quiet', T }) {
  const skin = tone === 'primary'
    ? { background: T.accentSoft, color: T.accentInk, border: `1px solid ${T.accent}` }
    : tone === 'danger'
    ? { background: T.dangerSoft, color: T.danger, border: `1px solid ${T.dangerBorder}` }
    : { background: 'transparent', color: T.ink60, border: `1px solid ${T.hairline}` };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...skin, padding: '5px 11px', borderRadius: T.r6, fontSize: 12,
      fontFamily: T.fontUI, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  );
}

function Input({ value, onChange, onEnter, placeholder, T }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
      placeholder={placeholder}
      style={{
        flex: 1, minWidth: 160, padding: '6px 10px', background: T.paper,
        border: `1px solid ${T.hairline}`, borderRadius: T.r6,
        fontSize: 12.5, color: T.ink, fontFamily: T.fontUI, outline: 'none',
      }}
    />
  );
}

/**
 * The follow-up thread on one task: where it stands, what is actually in the
 * way, what would unblock it, and what has been tried.
 *
 * Deliberately not opened for every task — a to-do list where every line asks
 * you questions is an interrogation. It starts closed, with one button.
 */
export default function FollowUp({ task }) {
  const { T } = useTheme();
  const { t } = useLocale();
  const [thread, setThread] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState(null);

  const [blockerDraft, setBlockerDraft] = useState('');
  const [needDraft, setNeedDraft] = useState('');
  const [optionDraft, setOptionDraft] = useState('');
  const [answerDraft, setAnswerDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const resp = await fetch(`${API}/tasks/${task.id}/thread`);
      if (resp.ok) {
        const t = (await resp.json()).thread;
        setThread(t);
        setBlockerDraft(t?.blocker?.text || '');
      }
    } catch { /* the panel still works without it */ }
    finally { setLoaded(true); }
  }, [task.id]);

  useEffect(() => { setLoaded(false); load(); }, [load]);

  async function act(body) {
    setBusy(true);
    try {
      const resp = await fetch(`${API}/tasks/${task.id}/thread/act`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (resp.ok) setThread((await resp.json()).thread);
    } catch { setNote(t('error.backendUnreachable')); }
    finally { setBusy(false); }
  }

  async function open() {
    setBusy(true);
    try {
      const resp = await fetch(`${API}/tasks/${task.id}/thread`, { method: 'POST' });
      if (resp.ok) setThread((await resp.json()).thread);
    } catch { setNote(t('error.backendUnreachable')); }
    finally { setBusy(false); }
  }

  async function suggest() {
    setSuggesting(true);
    setNote(null);
    try {
      const resp = await fetch(`${API}/tasks/${task.id}/thread/suggest`, { method: 'POST' });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) { setNote(t('thread.cannotAsk')); return; }
      setThread(body.thread);
      if (!body.added) setNote(t('thread.nothingNew'));
    } catch { setNote(t('thread.backendOrModelDown')); }
    finally { setSuggesting(false); }
  }

  if (!loaded) return null;

  if (!thread) {
    return (
      <div>
        <Label T={T}>{t('thread.label')}</Label>
        <div style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.55, marginBottom: 9 }}>
          {t('thread.pitch')}
        </div>
        <Btn onClick={open} disabled={busy} T={T}>{t('thread.open')}</Btn>
      </div>
    );
  }

  const blockedFor = thread.blocker ? daysSince(thread.blocker.since) : null;
  const lastAsk = [...(thread.checkIns || [])].reverse().find(c => c.answer === null);
  const openOptions = (thread.options || []).filter(o => o.status !== 'ruled-out');
  const ruledOut = (thread.options || []).filter(o => o.status === 'ruled-out');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
        <Label T={T}>{t('thread.label')}</Label>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: thread.state === 'blocked' ? T.warn : T.ink40 }}>
          {STATE_KEY[thread.state] ? t(STATE_KEY[thread.state]) : thread.state}
          {blockedFor !== null && thread.state === 'blocked' && ` · ${t('unit.days', { n: blockedFor })}`}
          {thread.state === 'parked' && ` · ${thread.mutedByUser ? t('thread.youMuted') : t('thread.stoppedAsking')}`}
        </span>
      </div>

      <div style={{
        border: `1px solid ${T.hairline}`, borderRadius: T.r6,
        background: T.paperSubtle, padding: '13px 15px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* A check-in waiting for an answer comes first — it is the live question. */}
        {lastAsk && (
          <div style={{
            background: T.paper, border: `1px solid ${T.accent}`, borderRadius: T.r6,
            padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 13, color: T.ink }}>{lastAsk.asked}</div>
            <Row T={T}>
              <Input value={answerDraft} onChange={setAnswerDraft} placeholder={t('thread.answerPlaceholder')}
                     onEnter={() => { if (answerDraft.trim()) { act({ action: 'answer', answer: answerDraft }); setAnswerDraft(''); } }} T={T} />
              <Btn tone="primary" disabled={busy || !answerDraft.trim()}
                   onClick={() => { act({ action: 'answer', answer: answerDraft }); setAnswerDraft(''); }} T={T}>{t('thread.answer')}</Btn>
            </Row>
          </div>
        )}

        {/* What is in the way — in the person's words, never inferred. */}
        <div>
          <Label T={T}>{t('thread.blockerLabel')}</Label>
          <Row T={T}>
            <Input value={blockerDraft} onChange={setBlockerDraft}
                   placeholder={t('thread.blockerPlaceholder')}
                   onEnter={() => act({ action: 'blocker', text: blockerDraft })} T={T} />
            <Btn disabled={busy} onClick={() => act({ action: 'blocker', text: blockerDraft })} T={T}>{t('common.save')}</Btn>
          </Row>
        </div>

        {/* What would unblock it */}
        <div>
          <Label T={T}>{t('thread.needsLabel')}</Label>
          {(thread.needs || []).map(n => (
            <div key={n.id} onClick={() => act({ action: 'toggleNeed', needId: n.id })} style={{
              display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer',
              fontSize: 12.5, color: n.done ? T.ink40 : T.ink, marginBottom: 5,
              textDecoration: n.done ? 'line-through' : 'none',
            }}>
              <span style={{
                width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                border: `1px solid ${n.done ? T.done : T.hairline}`,
                background: n.done ? T.done : 'transparent',
              }} />
              {n.text}
            </div>
          ))}
          <Row T={T}>
            <Input value={needDraft} onChange={setNeedDraft} placeholder={t('thread.needPlaceholder')}
                   onEnter={() => { if (needDraft.trim()) { act({ action: 'addNeed', text: needDraft }); setNeedDraft(''); } }} T={T} />
            <Btn disabled={busy || !needDraft.trim()}
                 onClick={() => { act({ action: 'addNeed', text: needDraft }); setNeedDraft(''); }} T={T}>{t('common.add')}</Btn>
          </Row>
        </div>

        {/* Ways forward */}
        <div>
          <Label T={T}>{t('thread.optionsLabel')}</Label>
          {openOptions.map(o => (
            <div key={o.id} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 7,
              padding: '8px 10px', borderRadius: T.r6, background: T.paper,
              border: `1px solid ${o.status === 'chosen' ? T.accent : T.hairlineSoft}`,
            }}>
              <div style={{ flex: 1, fontSize: 12.5, color: T.ink, lineHeight: 1.45 }}>
                {o.text}
                <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.ink40, marginLeft: 7 }}>
                  {o.source === 'suggested' ? t('thread.suggested') : t('thread.yours')}{o.status === 'chosen' ? ` · ${t('thread.doingThis')}` : ''}
                </span>
              </div>
              {o.status !== 'chosen' && (
                <Btn disabled={busy} onClick={() => act({ action: 'judgeOption', optionId: o.id, status: 'chosen' })} T={T}>{t('thread.doThis')}</Btn>
              )}
              <Btn disabled={busy} onClick={() => act({ action: 'judgeOption', optionId: o.id, status: 'ruled-out' })} T={T}>{t('thread.no')}</Btn>
            </div>
          ))}

          {/* Kept, not deleted: "we tried that" is what a thread is worth a month later. */}
          {ruledOut.length > 0 && (
            <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, marginBottom: 7, lineHeight: 1.6 }}>
              {t('thread.ruledOutList', { list: ruledOut.map(o => o.text + (o.note ? ` (${o.note})` : '')).join(' · ') })}
            </div>
          )}

          <Row T={T}>
            <Input value={optionDraft} onChange={setOptionDraft} placeholder={t('thread.optionPlaceholder')}
                   onEnter={() => { if (optionDraft.trim()) { act({ action: 'addOption', text: optionDraft, source: 'user' }); setOptionDraft(''); } }} T={T} />
            <Btn disabled={busy || !optionDraft.trim()}
                 onClick={() => { act({ action: 'addOption', text: optionDraft, source: 'user' }); setOptionDraft(''); }} T={T}>{t('common.add')}</Btn>
            <Btn disabled={suggesting} onClick={suggest} T={T}>{suggesting ? t('thread.thinking') : t('thread.askForIdeas')}</Btn>
          </Row>
        </div>

        {note && <div style={{ fontSize: 12, color: T.ink60, lineHeight: 1.5 }}>{note}</div>}

        <Row T={T}>
          {thread.state !== 'resolved' && (
            <Btn tone="primary" disabled={busy} onClick={() => act({ action: 'resolve' })} T={T}>{t('thread.resolve')}</Btn>
          )}
          {thread.state !== 'parked' && (
            <Btn disabled={busy} onClick={() => act({ action: 'mute' })} T={T}>{t('thread.mute')}</Btn>
          )}
        </Row>
      </div>
    </div>
  );
}

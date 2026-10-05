import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';

// Keys, not text: this list exists before any component, so it cannot hold
// translated strings — only the names of them.
const SUGGESTION_KEYS = ['chat.suggest1', 'chat.suggest2', 'chat.suggest3', 'chat.suggest4'];

export default function ChatPanel({ onClose, taskCount }) {
  const { t } = useLocale();
  const { T } = useTheme();
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: taskCount > 0
      ? t(taskCount === 1 ? 'chat.greetingOne' : 'chat.greetingMany', { n: taskCount })
      : t('chat.greetingEmpty'),
  }]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // The conversation used to start over every time this panel closed, because it
  // lived only in React state. It is now kept in the local journal, so pick it
  // back up — the greeting above is only what a first-ever conversation opens with.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${API}/chat/history?limit=40`);
        if (!resp.ok) return;
        const { messages: past } = await resp.json();
        if (cancelled || !Array.isArray(past) || past.length === 0) return;
        setMessages(prev => [...prev, ...past.map(m => ({ role: m.role, content: m.content }))]);
      } catch { /* a fresh conversation is a fine fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const history = messages.filter(m => !m.error).slice(-8);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resp = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw new Error();
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) { reader.cancel(); break; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: `⚠ ${data.error}`, error: true }; return u; });
            } else if (data.token) {
              setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + data.token }; return u; });
            } else if (data.done) {
              setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], streaming: false }; return u; });
            }
          } catch (e) { console.warn('SSE parse error:', e); }
        }
      }
      // Clear streaming flag; drop empty bubbles (server closed before any tokens)
      setMessages(prev => {
        const u = [...prev];
        const last = u[u.length - 1];
        if (last?.streaming) {
          if (!last.content) return u.slice(0, -1);
          return [...u.slice(0, -1), { ...last, streaming: false }];
        }
        return u;
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: t('chat.connectFailed'), error: true }; return u; });
      }
    } finally { setStreaming(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(25,25,26,0.25)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: 360, height: '100%',
        background: T.paper, borderLeft: `1px solid ${T.hairline}`,
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.2s ease-out',
        fontFamily: T.fontUI,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${T.hairlineSoft}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: T.r6,
              background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: T.ink }}>{t('chat.title')}</div>
              <div style={{ fontSize: 11, color: T.ink60, fontFamily: T.fontMono }}>{t('chat.poweredBy')}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 16, color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%', padding: '10px 14px', borderRadius: 12,
                fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                background: msg.role === 'user' ? T.ink : msg.error ? T.dangerSoft : T.paperSubtle,
                color: msg.role === 'user' ? T.paper : msg.error ? T.danger : T.ink80,
                border: `1px solid ${msg.role === 'user' ? 'transparent' : T.hairline}`,
              }}>
                {msg.content}
                {msg.streaming && (
                  <span style={{ display: 'inline-block', width: 2, height: 14, background: T.accent, marginLeft: 3, verticalAlign: 'middle', animation: 'clarityBlink 1s steps(2) infinite' }} />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div style={{ padding: '0 20px 12px' }}>
            <p style={{ fontSize: 11.5, color: T.ink60, marginBottom: 8, fontFamily: T.fontMono }}>{t('chat.tryAsking')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUGGESTION_KEYS.map(k => t(k)).map((s, i) => (
                <button key={i} onClick={() => { setInput(s); inputRef.current?.focus(); }} style={{
                  fontSize: 11.5, padding: '4px 10px', borderRadius: T.rPill,
                  background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                  color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${T.hairline}` }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={t('chat.askAboutYourTasks')}
              rows={2}
              disabled={streaming}
              style={{
                flex: 1, padding: '9px 12px',
                background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                borderRadius: T.r6, fontSize: 13, color: T.ink,
                fontFamily: T.fontUI, resize: 'none', outline: 'none',
                opacity: streaming ? 0.5 : 1,
              }}
            />
            <button onClick={send} disabled={!input.trim() || streaming} style={{
              padding: '0 14px', background: T.ink, border: 'none',
              borderRadius: T.r6, color: T.paper, cursor: !input.trim() || streaming ? 'not-allowed' : 'pointer',
              opacity: !input.trim() || streaming ? 0.3 : 1,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 11, color: T.ink40, marginTop: 6, fontFamily: T.fontMono }}>{t('chat.enterToSend')}</p>
        </div>
      </div>
    </div>
  );
}

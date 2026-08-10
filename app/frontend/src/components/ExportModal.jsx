import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';

const API = 'http://localhost:3001/api';

function toMarkdown(data) {
  const { tasks, analysis, weeklySummary, exportedAt } = data;
  const lines = [`# Clarity Export`, `Exported: ${new Date(exportedAt).toLocaleString()}`, ''];
  if (analysis?.whatToDoNext) lines.push('## AI Recommendation', analysis.whatToDoNext, '');
  lines.push('## Tasks', '');
  tasks.forEach(task => {
    const ai = analysis?.taskAnalysis?.find(a => a.id === task.id);
    lines.push(`### ${task.title}`);
    lines.push(`- **Status:** ${task.status.replace('_', ' ')}`);
    if (task.deadline) lines.push(`- **Deadline:** ${task.deadline}`);
    if (task.deliverable) lines.push(`- **Deliverable:** ${task.deliverable}`);
    if (ai) lines.push(`- **Priority:** #${ai.priority} (${ai.priorityLevel})`);
    if (task.description) lines.push(``, task.description);
    if (task.subtasks?.length) {
      lines.push('', '**Subtasks:**');
      task.subtasks.forEach(s => lines.push(`- [${s.done ? 'x' : ' '}] ${s.title}`));
    }
    if (ai?.actionPlan?.length) {
      lines.push('', '**Action Plan:**');
      ai.actionPlan.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    }
    if (ai?.reasoning) lines.push('', `*AI reasoning: ${ai.reasoning}*`);
    lines.push('');
  });
  if (weeklySummary?.content) lines.push('## Weekly Summary', weeklySummary.content, '');
  return lines.join('\n');
}

export default function ExportModal({ onClose }) {
  const { T } = useTheme();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleExport(format) {
    setLoading(true);
    try {
      const resp = await fetch(`${API}/export`);
      const data = await resp.json();
      let content, filename, type;
      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        filename = `clarity-export-${new Date().toISOString().split('T')[0]}.json`;
        type = 'application/json';
      } else {
        content = toMarkdown(data);
        filename = `clarity-export-${new Date().toISOString().split('T')[0]}.md`;
        type = 'text/markdown';
      }
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(onClose, 1500);
    } catch { alert('Export failed. Is the backend running?'); }
    finally { setLoading(false); }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(25,25,26,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: T.fontUI }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: T.paper, borderRadius: T.r14,
        border: `1px solid ${T.hairline}`,
        boxShadow: '0 24px 60px rgba(25,25,26,0.15)',
        width: '100%', maxWidth: 380,
        animation: 'fadeUp 0.15s ease-out',
      }}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 500, color: T.ink }}>Export Data</h2>
            <button onClick={onClose} style={{ fontSize: 16, color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>✕</button>
          </div>

          {done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8, color: T.done }}>✓</div>
              <p style={{ fontSize: 13.5, color: T.ink60 }}>Export downloaded!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12.5, color: T.ink60, margin: '0 0 4px' }}>
                Export all your tasks, AI analysis, and weekly summaries.
              </p>
              {[
                { fmt: 'markdown', label: 'Markdown', tag: 'MD', hint: 'Human-readable, works in Notion, Obsidian' },
                { fmt: 'json',     label: 'JSON',     tag: '{}', hint: 'Full data with AI analysis included' },
              ].map(({ fmt, label, tag, hint }) => (
                <button key={fmt} onClick={() => handleExport(fmt)} disabled={loading} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', textAlign: 'left',
                  background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                  borderRadius: T.r10, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1, transition: 'background 0.1s',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: T.r6,
                    background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: T.fontMono, fontSize: 11, fontWeight: 600, color: T.accentInk, flexShrink: 0,
                  }}>{tag}</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: T.ink }}>{label}</div>
                    <div style={{ fontSize: 12, color: T.ink60, marginTop: 2 }}>{hint}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

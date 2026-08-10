import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';

function generateId() { return Math.random().toString(36).slice(2, 10); }

const TAG_PALETTE = [
  '#5b6cf9', '#2da3e0', '#27a87a', '#c9962a', '#d65f70', '#1ba6b5',
];

export function tagColor(tag) {
  let h = 0;
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) % TAG_PALETTE.length;
  const hex = TAG_PALETTE[h];
  return { color: hex, hex };
}

export default function TaskForm({ task, onSave, onClose, saving }) {
  const { T } = useTheme();
  const [form, setForm] = useState({
    title: '', description: '', deadline: '', deliverable: '',
    status: 'not_started', notes: '', subtasks: [], tags: [], recurring: 'none',
  });
  const [newSubtask, setNewSubtask] = useState('');
  const [newTag, setNewTag] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    if (task) {
      setForm({
        title:       task.title        || '',
        description: task.description  || '',
        deadline:    task.deadline     ? task.deadline.split('T')[0] : '',
        deliverable: task.deliverable  || '',
        status:      task.status       || 'not_started',
        notes:       task.notes        || '',
        subtasks:    (task.subtasks    || []).filter(s => s?.id && s?.title),
        tags:        task.tags         || [],
        recurring:   task.recurring    || 'none',
      });
    }
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [task]);

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  function addSubtask() {
    if (!newSubtask.trim()) return;
    const entry = { id: generateId(), title: newSubtask.trim(), done: false };
    setForm(prev => ({ ...prev, subtasks: [...prev.subtasks, entry] }));
    setNewSubtask('');
  }

  function addTag() {
    const t = newTag.trim().toLowerCase();
    if (!t) { setNewTag(''); return; }
    setForm(prev => {
      if (prev.tags.includes(t)) return prev;
      return { ...prev, tags: [...prev.tags, t] };
    });
    setNewTag('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ ...form, deadline: form.deadline || null });
  }

  const field = {
    width: '100%', padding: '9px 12px',
    background: T.paperSubtle, border: `1px solid ${T.hairline}`,
    borderRadius: T.r6, fontSize: 13.5, color: T.ink,
    fontFamily: T.fontUI, outline: 'none',
    transition: 'border-color 0.1s',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(25,25,26,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        fontFamily: T.fontUI,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      <div style={{
        background: T.paper, borderRadius: T.r14,
        border: `1px solid ${T.hairline}`,
        boxShadow: '0 32px 80px -24px rgba(25,25,26,0.2), 0 2px 8px rgba(25,25,26,0.06)',
        width: '100%', maxWidth: 520, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'fadeUp 0.15s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${T.hairlineSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 500, letterSpacing: '-0.02em', color: T.ink }}>
              {task ? 'Edit Task' : 'New Task'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: T.ink60 }}>
              Describe in plain language — AI handles the rest
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ fontSize: 16, color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '4px 6px' }}
          >✕</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ overflow: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              Title *
            </label>
            <input ref={titleRef} value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Finish project proposal" required style={field} />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              Description
            </label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="What needs to happen?" rows={3}
              style={{ ...field, resize: 'vertical', lineHeight: 1.55 }} />
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              Tags
            </label>
            {form.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {form.tags.map(tag => {
                  const c = tagColor(tag);
                  return (
                    <span key={tag} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 12, padding: '3px 9px', borderRadius: T.rPill,
                      background: T.paperSubtle, color: T.ink60,
                      border: `1px solid ${T.hairline}`,
                      fontFamily: T.fontMono,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      {tag}
                      <button type="button" onClick={() => set('tags', form.tags.filter(t => t !== tag))}
                        style={{ color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tag and press Enter…"
                style={{ ...field, flex: 1, padding: '7px 12px' }} />
            </div>
          </div>

          {/* Deadline + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
                Deadline
              </label>
              <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)}
                style={{ ...field }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
                Status
              </label>
              <div style={{ position: 'relative' }}>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  style={{ ...field, width: '100%', paddingRight: 28, cursor: 'pointer' }}>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: T.ink40, pointerEvents: 'none', fontSize: 10 }}>▾</span>
              </div>
            </div>
          </div>

          {/* Recurring + Deliverable */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
                Recurring
              </label>
              <div style={{ position: 'relative' }}>
                <select value={form.recurring} onChange={e => set('recurring', e.target.value)}
                  style={{ ...field, width: '100%', paddingRight: 28, cursor: 'pointer' }}>
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: T.ink40, pointerEvents: 'none', fontSize: 10 }}>▾</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
                Deliverable
              </label>
              <input value={form.deliverable} onChange={e => set('deliverable', e.target.value)}
                placeholder="End result…" style={{ ...field, padding: '7px 12px' }} />
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              Subtasks
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {form.subtasks.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: T.ink80 }}>{s.title}</span>
                  <button type="button" onClick={() => set('subtasks', form.subtasks.filter(x => x.id !== s.id))}
                    style={{ color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                placeholder="Add a subtask and press Enter…"
                style={{ ...field, flex: 1, padding: '7px 12px' }} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              Notes
            </label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Extra context for the AI…" rows={2}
              style={{ ...field, resize: 'vertical', lineHeight: 1.55 }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px 0',
              background: T.paperSubtle, border: `1px solid ${T.hairline}`,
              borderRadius: T.r6, fontSize: 13.5, color: T.ink60,
              cursor: 'pointer', fontFamily: T.fontUI,
            }}>Cancel</button>
            <button type="submit" disabled={saving || !form.title.trim()} style={{
              flex: 1, padding: '10px 0',
              background: T.ink, border: 'none',
              borderRadius: T.r6, fontSize: 13.5, fontWeight: 500, color: T.paper,
              cursor: saving || !form.title.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !form.title.trim() ? 0.4 : 1,
              fontFamily: T.fontUI,
            }}>
              {saving ? 'Saving…' : task ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

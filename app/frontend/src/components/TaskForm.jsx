import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

function generateId() { return Math.random().toString(36).slice(2, 10); }

// minutes → les deux champs de saisie, et retour.
export function splitEstimate(minutes) {
  if (typeof minutes !== 'number' || minutes <= 0) return { estimateValue: '', estimateUnit: 'min' };
  if (minutes % 60 === 0) return { estimateValue: String(minutes / 60), estimateUnit: 'h' };
  return { estimateValue: String(minutes), estimateUnit: 'min' };
}

// Rendre null plutôt que 0 quand le champ est vide : la métrique d'estimation
// n'accepte qu'une durée > 0, et un 0 enregistré se lirait comme « estimé à
// rien » au lieu de « pas estimé ».
export function joinEstimate(value, unit) {
  const n = parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(unit === 'h' ? n * 60 : n);
}

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
  const { t } = useLocale();
  const { T } = useTheme();
  // estimateValue + estimateUnit sont des champs de SAISIE, pas le modèle. Le
  // backend ne connaît que `estimatedDuration`, en minutes ; la paire n'existe
  // que pour qu'on puisse écrire « 2 heures » sans convertir de tête, et elle
  // est reconvertie avant l'envoi. Rien d'autre dans l'app ne les voit.
  const [form, setForm] = useState({
    title: '', description: '', deadline: '', deliverable: '',
    status: 'not_started', notes: '', subtasks: [], tags: [], recurring: 'none',
    estimateValue: '', estimateUnit: 'min',
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
        // Les heures rondes se relisent en heures. 90 min reste en minutes
        // plutôt que de devenir « 1,5 h », qu'on ne pourrait pas ressaisir
        // sans décimale.
        ...splitEstimate(task.estimatedDuration),
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
    // estimateValue/estimateUnit ne quittent pas ce composant : on envoie la
    // minute que le backend attend, et rien d'autre.
    const { estimateValue, estimateUnit, ...rest } = form;
    onSave({
      ...rest,
      deadline: form.deadline || null,
      estimatedDuration: joinEstimate(estimateValue, estimateUnit),
    });
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
              {task ? t('form.editTitle') : t('form.newTitle')}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: T.ink60 }}>
              {t('form.plainLanguage')}
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
              {t('form.title')}
            </label>
            <input ref={titleRef} value={form.title} onChange={e => set('title', e.target.value)}
              placeholder={t('form.eGFinishProjectProposal')} required style={field} />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              {t('form.description')}
            </label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder={t('form.whatNeedsToHappen')} rows={3}
              style={{ ...field, resize: 'vertical', lineHeight: 1.55 }} />
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              {t('form.tags')}
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
                placeholder={t('form.addTagAndPressEnter')}
                style={{ ...field, flex: 1, padding: '7px 12px' }} />
            </div>
          </div>

          {/* Deadline + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
                {t('detail.deadline')}
              </label>
              <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)}
                style={{ ...field }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
                {t('form.status')}
              </label>
              <div style={{ position: 'relative' }}>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  style={{ ...field, width: '100%', paddingRight: 28, cursor: 'pointer' }}>
                  <option value="not_started">{t('status.notStarted')}</option>
                  <option value="in_progress">{t('status.inProgress')}</option>
                  <option value="done">{t('status.done')}</option>
                </select>
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: T.ink40, pointerEvents: 'none', fontSize: 10 }}>▾</span>
              </div>
            </div>
          </div>

          {/* Récurrence + Durée estimée */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
                {t('form.recurring')}
              </label>
              <div style={{ position: 'relative' }}>
                <select value={form.recurring} onChange={e => set('recurring', e.target.value)}
                  style={{ ...field, width: '100%', paddingRight: 28, cursor: 'pointer' }}>
                  <option value="none">{t('form.oneTime')}</option>
                  <option value="daily">{t('form.daily')}</option>
                  <option value="weekly">{t('form.weekly')}</option>
                  <option value="monthly">{t('form.monthly')}</option>
                </select>
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: T.ink40, pointerEvents: 'none', fontSize: 10 }}>▾</span>
              </div>
            </div>
            {/* Durée estimée. Sans ce champ, `estimatedDuration` n'avait qu'une
                seule entrée dans toute l'app — la syntaxe « ~2h » de la saisie
                rapide — et le biais d'estimation du profil, qui exige une
                estimation ET un temps mesuré sur cinq tâches, ne pouvait pas
                atteindre son seuil. */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
                {t('form.estimate')}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {/* step="any", surtout pas une valeur ronde : avec step="5" la
                    validation HTML5 refusait « 2 » — deux HEURES — et bloquait
                    la soumission du formulaire entier, sans message. Les unités
                    utiles ici vont de 15 min à 1,5 h ; aucune grille ne les
                    couvre. */}
                <input type="number" min="0" step="any" inputMode="decimal"
                  value={form.estimateValue} onChange={e => set('estimateValue', e.target.value)}
                  placeholder={t('form.estimatePlaceholder')}
                  style={{ ...field, flex: 1, minWidth: 0 }} />
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <select value={form.estimateUnit} onChange={e => set('estimateUnit', e.target.value)}
                    style={{ ...field, width: 'auto', paddingRight: 26, cursor: 'pointer' }}>
                    <option value="min">{t('form.unitMinutes')}</option>
                    <option value="h">{t('form.unitHours')}</option>
                  </select>
                  <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: T.ink40, pointerEvents: 'none', fontSize: 10 }}>▾</span>
                </div>
              </div>
            </div>
          </div>

          {/* Livrable */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              {t('form.deliverable')}
            </label>
            <input value={form.deliverable} onChange={e => set('deliverable', e.target.value)}
              placeholder={t('form.endResult')} style={{ ...field, padding: '7px 12px' }} />
          </div>

          {/* Subtasks */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              {t('task.subtasks')}
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
                placeholder={t('form.addASubtaskAndPress')}
                style={{ ...field, flex: 1, padding: '7px 12px' }} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              {t('detail.notes')}
            </label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder={t('form.extraContextForTheAi')} rows={2}
              style={{ ...field, resize: 'vertical', lineHeight: 1.55 }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px 0',
              background: T.paperSubtle, border: `1px solid ${T.hairline}`,
              borderRadius: T.r6, fontSize: 13.5, color: T.ink60,
              cursor: 'pointer', fontFamily: T.fontUI,
            }}>{t('common.cancel')}</button>
            <button type="submit" disabled={saving || !form.title.trim()} style={{
              flex: 1, padding: '10px 0',
              background: T.ink, border: 'none',
              borderRadius: T.r6, fontSize: 13.5, fontWeight: 500, color: T.paper,
              cursor: saving || !form.title.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !form.title.trim() ? 0.4 : 1,
              fontFamily: T.fontUI,
            }}>
              {saving ? t('common.saving') : task ? t('form.saveChanges') : t('form.addTask')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

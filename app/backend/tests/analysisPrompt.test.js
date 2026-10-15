import { describe, test, expect } from '@jest/globals';
import { buildAnalysisPrompt, restoreIds, guessLanguage, maxChars } from '../src/llm/analysisPrompt.js';
import { wouldTruncate } from '../src/llm/OllamaProvider.js';

const tasks = [
  { id: 'a1b2c3d4-0001-0000-0000-000000000001', title: 'Lancer la v1', status: 'in_progress' },
  { id: 'a1b2c3d4-0002-0000-0000-000000000002', title: 'Page d’accueil', status: 'not_started' },
  { id: 'a1b2c3d4-0003-0000-0000-000000000003', title: 'Certificat', status: 'not_started' },
];

describe('analysis prompt', () => {
  test('never shows a real id to the model — only T-names', () => {
    const { text } = buildAnalysisPrompt(tasks);
    for (const t of tasks) expect(text).not.toContain(t.id);
    expect(text).toContain('Task T1:');
    expect(text).toContain('Task T3:');
  });

  test('the schema allows exactly one entry per task, and only real names', () => {
    const { schema } = buildAnalysisPrompt(tasks);
    const list = schema.properties.taskAnalysis;
    expect(list.minItems).toBe(3);
    expect(list.maxItems).toBe(3);
    expect(list.items.properties.id.enum).toEqual(['T1', 'T2', 'T3']);
    expect(list.items.properties.suggestedLinks.items.properties.to.enum).toEqual(['T1', 'T2', 'T3']);
    expect(list.items.properties.suggestedLinks.maxItems).toBe(2);
    expect(list.items.properties.suggestedLevel.enum).toEqual(['top', 'very_high', 'high', 'medium', 'low', 'very_low']);
  });

  test('names come back as real ids; unknown names are dropped, not guessed', () => {
    const out = restoreIds({
      whatToDoNext: 'x',
      taskAnalysis: [
        { id: 'T1', suggestedLinks: [{ to: 'T2', type: 'blocks', strength: 'soft', why: 'T2 first' }, { to: 't3', type: 'related' }, { to: 'T9', type: 'blocks' }, { to: 'T1', type: 'blocks' }], suggestedLevel: 'urgent', suggestedDifficulty: 9 },
        { id: 'T7', suggestedLinks: [] },
      ],
    }, tasks);
    expect(out.taskAnalysis).toHaveLength(1);
    expect(out.taskAnalysis[0].id).toBe(tasks[0].id);
    // Unknown names, and a link to itself, are dropped; the why is prose.
    expect(out.taskAnalysis[0].suggestedLinks).toEqual([
      { to: tasks[1].id, type: 'blocks', strength: 'soft', why: '« Page d’accueil » first' },
      { to: tasks[2].id, type: 'related', strength: 'hard', why: '' },
    ]);
    // Outside the scale: no proposal rather than a wrong one.
    expect(out.taskAnalysis[0].suggestedLevel).toBeNull();
    expect(out.taskAnalysis[0].suggestedDifficulty).toBeNull();
    expect(out.whatToDoNext).toBe('x');
  });

  test('a reply without taskAnalysis passes through untouched', () => {
    expect(restoreIds(null, tasks)).toBeNull();
    expect(restoreIds({ a: 1 }, tasks)).toEqual({ a: 1 });
  });
});

describe('what the person reads', () => {
  test('a T-name left in a sentence becomes the task’s title', () => {
    const out = restoreIds({
      whatToDoNext: 'Start Task T3 to unblock T1.',
      overallInsight: 'tâche T2 first',
      taskAnalysis: [{ id: 'T1', reasoning: 'Needs T3.', suggestedLinks: [{ to: 'T2', type: 'related', why: 'T9 is unknown' }], actionPlan: ['Finish T2'] }],
    }, tasks);
    expect(out.whatToDoNext).toBe('Start « Certificat » to unblock « Lancer la v1 ».');
    expect(out.overallInsight).toBe('« Page d’accueil » first');
    expect(out.taskAnalysis[0].reasoning).toBe('Needs « Certificat ».');
    expect(out.taskAnalysis[0].suggestedLinks[0].why).toBe('T9 is unknown');   // not a task: left alone
    expect(out.taskAnalysis[0].actionPlan).toEqual(['Finish « Page d’accueil »']);
  });

  test('the language is named, read from the tasks', () => {
    expect(guessLanguage([{ title: 'Faire ma déclaration d’impôts', description: 'Je repousse depuis 3 semaines' }])).toBe('French');
    expect(guessLanguage([{ title: 'Book the dentist', description: 'and get the form for my insurance' }])).toBe('English');
    expect(buildAnalysisPrompt(tasks).text).toContain('Write every sentence in French.');
  });
});

describe('reply length', () => {
  test('the cap covers the longest reply the schema allows', () => {
    const p = buildAnalysisPrompt(tasks);
    expect(p.maxTokens * 2.5).toBeGreaterThanOrEqual(maxChars(p.schema));
  });

  test('twelve long tasks and their longest reply still fit the context', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `id-${i}`, title: 'x'.repeat(120), description: 'é'.repeat(300), notes: 'n'.repeat(300),
      deliverable: 'd'.repeat(160), status: 'not_started', tags: ['a', 'b'],
    }));
    const p = buildAnalysisPrompt(many);
    expect(wouldTruncate(p.text.length, p.maxTokens)).toBe(false);
  });
});

describe('what the person decided reaches the assistant (1.8.0)', () => {
  test('level, difficulty and « must be finished before », by short name', () => {
    const tasks = [
      { id: 'a', title: 'Payer le loyer', status: 'not_started', priority: 'top', difficulty: 2, links: [{ to: 'b', type: 'blocks', strength: 'hard' }, { to: 'c', type: 'blocks', strength: 'soft' }, { to: 'gone', type: 'blocks' }] },
      { id: 'b', title: 'Fermer le mois', status: 'not_started' },
      { id: 'c', title: 'Archiver les reçus', status: 'not_started' },
    ];
    const { text } = buildAnalysisPrompt(tasks, 'French');
    expect(text).toContain('Priority set by the person: top priority');
    expect(text).toContain('Difficulty: 2/5');
    expect(text).toContain('Must be finished before: T2, T3 (preferably)');
    expect(text).not.toContain('gone');
    expect(text).toContain('A priority set by the person is never overruled');
  });
});

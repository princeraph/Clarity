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
    expect(list.items.properties.dependencies.items.enum).toEqual(['T1', 'T2', 'T3']);
  });

  test('names come back as real ids; unknown names are dropped, not guessed', () => {
    const out = restoreIds({
      whatToDoNext: 'x',
      taskAnalysis: [
        { id: 'T1', dependencies: ['T2', 'T3', 'T9'], relatedTasks: ['t2'] },
        { id: 'T7', dependencies: [] },
      ],
    }, tasks);
    expect(out.taskAnalysis).toHaveLength(1);
    expect(out.taskAnalysis[0].id).toBe(tasks[0].id);
    expect(out.taskAnalysis[0].dependencies).toEqual([tasks[1].id, tasks[2].id]);
    expect(out.taskAnalysis[0].relatedTasks).toEqual([tasks[1].id]);
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
      taskAnalysis: [{ id: 'T1', reasoning: 'Needs T3.', relationshipNote: 'T9 is unknown', actionPlan: ['Finish T2'] }],
    }, tasks);
    expect(out.whatToDoNext).toBe('Start « Certificat » to unblock « Lancer la v1 ».');
    expect(out.overallInsight).toBe('« Page d’accueil » first');
    expect(out.taskAnalysis[0].reasoning).toBe('Needs « Certificat ».');
    expect(out.taskAnalysis[0].relationshipNote).toBe('T9 is unknown');   // not a task: left alone
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

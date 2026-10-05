import { describe, test, expect } from '@jest/globals';
import { buildAnalysisPrompt, restoreIds } from '../src/llm/analysisPrompt.js';

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

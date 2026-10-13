import { describe, test, expect } from '@jest/globals';
import { languageName, promptLanguage, buildAnalysisPrompt } from '../src/llm/analysisPrompt.js';

// The AI's text (plan, weekly review, subtasks) followed a guess from task
// titles; short French titles read as English. The language chosen in Clarity wins.
describe('language of the AI text', () => {
  test('the chosen language wins over the guess', () => {
    const englishLooking = [{ title: 'RDV dentiste' }, { title: 'Gym' }];
    expect(promptLanguage('fr-FR', englishLooking)).toBe('French');
    expect(promptLanguage('en-US', [{ title: 'Faire les courses pour la semaine' }])).toBe('English');
  });
  test('no choice known: fall back to the guess', () => {
    expect(promptLanguage(undefined, [{ title: 'Faire les courses pour la semaine' }])).toBe('French');
    expect(languageName('de-DE')).toBe(null);
    expect(languageName(42)).toBe(null);
  });
  test('the analysis prompt names the language it was given', () => {
    const p = buildAnalysisPrompt([{ title: 'Gym', status: 'not_started' }], 'French');
    expect(p.text ?? p).toMatch(/Write every sentence in French/);
  });
});

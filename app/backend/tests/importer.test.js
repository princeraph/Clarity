import { describe, test, expect } from '@jest/globals';
import { parseImport, csvRows, readDate } from '../src/importer.js';

describe('import', () => {
  test('a Clarity export, tasks as they were', () => {
    const r = parseImport(JSON.stringify({ tasks: [{ title: 'Rapport', deadline: '2026-10-20', priority: 'top', tags: ['travail'], status: 'done', id: 'x', history: [] }], archivedTasks: [{ title: 'Vieux' }] }));
    expect(r.format).toBe('clarity');
    expect(r.tasks).toEqual([{ title: 'Rapport', deadline: '2026-10-20', priority: 'top', tags: ['travail'], status: 'done' }, { title: 'Vieux' }]);
  });
  test('a Todoist CSV: tasks only, its priority 1 is the highest, a loose date kept in the notes', () => {
    const csv = 'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE\n'
      + 'section,Travail,,,,,,,,\n'
      + 'task,"Appeler, puis écrire",Voir le dossier,1,1,,,2026-10-21,fr,\n'
      + 'task,Courses,,4,1,,,every friday,en,\n'
      + 'note,Une note,,,,,,,,\n';
    const r = parseImport(csv);
    expect(r.format).toBe('todoist');
    expect(r.tasks).toEqual([
      { title: 'Appeler, puis écrire', description: 'Voir le dossier', deadline: '2026-10-21', priority: 'very_high' },
      { title: 'Courses', description: 'Todoist : every friday' },
    ]);
  });
  test('any CSV with a title column, in French, with semicolons', () => {
    const r = parseImport('Titre;Échéance;Notes;Priorité\nPayer la facture;20/10/2026;Avant midi;Haute\n;;;\nRelire;;;\n');
    expect(r.format).toBe('csv');
    expect(r.tasks).toEqual([{ title: 'Payer la facture', description: 'Avant midi', deadline: '2026-10-20', priority: 'high' }, { title: 'Relire' }]);
  });
  test('plain text: one per line, bullets and boxes removed, [x] done', () => {
    expect(parseImport('- Lire le contrat\n* Appeler Léa\n\n1. Payer\n[x] Envoyer le devis\n[ ] Ranger\n').tasks).toEqual([
      { title: 'Lire le contrat' }, { title: 'Appeler Léa' }, { title: 'Payer' }, { title: 'Envoyer le devis', status: 'done' }, { title: 'Ranger' },
    ]);
  });
  test('what is already there (same title and date) is not imported twice', () => {
    const r = parseImport('Rapport\nrapport\nNouveau', [{ title: 'RAPPORT', deadline: null }]);
    expect(r.tasks).toEqual([{ title: 'Nouveau' }]);
    expect(r.skipped).toBe(2);
  });
  test('dates: ISO, day first, month first only when it must be', () => {
    expect(readDate('2026-10-20T09:00')).toBe('2026-10-20');
    expect(readDate('05/10/2026')).toBe('2026-10-05');
    expect(readDate('10/25/2026')).toBe('2026-10-25');
    expect(readDate('31/02/2026')).toBeNull();
    expect(readDate('tomorrow')).toBeNull();
  });
  test('CSV: quotes, doubled quotes, line breaks inside a cell', () => {
    expect(csvRows('a,b\n"x, ""y""","1\n2"\n')).toEqual([['a', 'b'], ['x, "y"', '1\n2']]);
  });
  test('a broken JSON is read as text, not refused', () => {
    expect(parseImport('{ pas du json').format).toBe('text');
  });
  test('at most 2000 at once', () => {
    const r = parseImport(Array.from({ length: 2100 }, (_, i) => `Tâche ${i}`).join('\n'));
    expect(r.tasks.length).toBe(2000);
    expect(r.tooMany).toBe(true);
  });
});

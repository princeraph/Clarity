// The task analysis: the prompt, the reply schema, and the way back to real ids.
//
// Tasks are named T1, T2… in the prompt, never by their ids. An id is 36
// characters — about twenty tokens — and the reply repeats them in every
// dependency and related task. Measured on Gemma 4 E2B with six tasks: 1 020
// tokens and a reply cut off mid-JSON with real ids; 621 tokens and a complete,
// valid reply with T-numbers. Fewer tokens is also less waiting, for every
// provider. The model only ever sees the short names; `restoreIds` maps them
// back, and drops any name that does not exist rather than trust it.

export function shortName(i) { return `T${i + 1}`; }

// "Write in the language the tasks are written in" was not enough: on four
// French tasks, Gemma 4 E2B answered in English (5 October). Small models
// follow a language they are told by name. The analysis runs in the background,
// with no request to read a UI language from, so it is read from the tasks.
const FRENCH = /\b(le|la|les|de|des|du|un|une|et|pour|avec|dans|sur|mon|ma|mes|ton|ta|tes|au|aux|faire|est)\b|[àâçéèêëîïôûùœ]/gi;
const ENGLISH = /\b(the|a|an|and|for|with|in|on|my|your|to|of|is|do|make|get)\b/gi;
export function guessLanguage(tasks) {
  const text = tasks.map(t => `${t.title || ''} ${t.description || ''}`).join(' ');
  const fr = (text.match(FRENCH) || []).length;
  const en = (text.match(ENGLISH) || []).length;
  return fr > en ? 'French' : 'English';
}

export function buildAnalysisPrompt(tasks) {
  const taskList = tasks.map((t, i) =>
    `Task ${shortName(i)}:\nTitle: ${t.title}\nDescription: ${(t.description || 'N/A').slice(0, 300)}\n` +
    `Deadline: ${t.deadline || 'None'}\nDeliverable: ${(t.deliverable || 'N/A').slice(0, 160)}\nStatus: ${t.status}\n` +
    `Tags: ${t.tags?.join(', ') || 'None'}\nRecurring: ${t.recurring || 'none'}\n` +
    `Subtasks: ${t.subtasks?.length ? t.subtasks.map(s => `${s.done ? '[done]' : '[todo]'} ${s.title}`).join(', ') : 'None'}\n` +
    `Notes: ${(t.notes || 'N/A').slice(0, 300)}`
  ).join('\n\n');

  const language = guessLanguage(tasks);
  const text = `You are a productivity assistant. Analyze these ${tasks.length} task(s) and return JSON.

TASKS:
${taskList}

Return ONLY this JSON:
{
  "whatToDoNext": "One specific action to take right now and why (ONE sentence)",
  "overallInsight": "One observation about this workload (ONE sentence)",
  "taskAnalysis": [
    {
      "id": "the task's name, e.g. T1",
      "priority": 1,
      "priorityLevel": "high",
      "reasoning": "Why this priority (ONE short sentence)",
      "actionPlan": ["Step 1", "Step 2"],
      "dependencies": ["names of tasks that must be done before this, e.g. T3"],
      "relatedTasks": ["names of related tasks"],
      "relationshipNote": "How tasks connect, or empty string"
    }
  ]
}

Rules: priority 1 = do first. priorityLevel = high/medium/low. Include all ${tasks.length} tasks. Write every sentence in ${language}. In sentences, call a task by its title, never by its name (T1, T2…).`;

  // For providers that can enforce a shape (the built-in engine): exactly one
  // entry per task, only real names, bounded lengths — so the reply can neither
  // run on nor come back empty.
  const name = { enum: tasks.map((_, i) => shortName(i)) };
  const schema = {
    type: 'object',
    properties: {
      whatToDoNext:   { type: 'string', maxLength: 200 },
      overallInsight: { type: 'string', maxLength: 200 },
      taskAnalysis: {
        type: 'array', minItems: tasks.length, maxItems: tasks.length,
        items: {
          type: 'object',
          properties: {
            id: name,
            priority: { type: 'integer' },
            priorityLevel: { enum: ['high', 'medium', 'low'] },
            reasoning: { type: 'string', maxLength: 140 },
            actionPlan: { type: 'array', items: { type: 'string', maxLength: 80 }, minItems: 1, maxItems: 2 },
            dependencies: { type: 'array', items: name, maxItems: 3 },
            relatedTasks: { type: 'array', items: name, maxItems: 3 },
            relationshipNote: { type: 'string', maxLength: 140 },
          },
        },
      },
    },
  };

  return { text, schema, maxTokens: tokensFor(schema) };
}

// The longest reply the schema allows, in characters. Every string is bounded,
// every list has a maximum, so this is a real ceiling — not an estimate.
export function maxChars(schema) {
  if (schema.enum) return Math.max(...schema.enum.map(v => JSON.stringify(v).length));
  if (schema.type === 'string') return (schema.maxLength ?? 200) + 2;
  if (schema.type === 'integer') return 4;
  if (schema.type === 'array') return 2 + (schema.maxItems ?? 10) * (maxChars(schema.items) + 1);
  if (schema.type === 'object') {
    return 2 + Object.entries(schema.properties).reduce((sum, [k, v]) => sum + k.length + 4 + maxChars(v), 0);
  }
  return 20;
}

// maxTokens was once guessed per task (180 + 70 each). Right in English; in
// French the same reply is longer, and four French tasks were cut off mid-JSON
// (5 October). Derived from the schema's ceiling instead, it cannot cut a reply
// the schema allows. JSON is dense in tokens — punctuation, short keys, accents
// — hence 2.5 characters per token, on the safe side. A cap, not a target: the
// grammar ends the reply when the JSON closes.
export function tokensFor(schema) { return Math.ceil(maxChars(schema) / 2.5); }

// T-names back to real ids. Unknown names are dropped, never guessed.
export function restoreIds(analysis, tasks) {
  if (!analysis || !Array.isArray(analysis.taskAnalysis)) return analysis;
  const byName = new Map(tasks.map((t, i) => [shortName(i), t.id]));
  const real = n => byName.get(String(n).trim().toUpperCase());
  const ids = list => (Array.isArray(list) ? list : []).map(real).filter(Boolean);
  // The person never saw a T-name, so one left in a sentence ("Start T4") reads
  // as nonsense. Told not to, a small model still does it: they become titles.
  const titles = new Map(tasks.map((t, i) => [shortName(i), t.title]));
  const quote = title => `« ${title.length > 50 ? title.slice(0, 49) + '…' : title} »`;
  const prose = v => typeof v !== 'string' ? v
    : v.replace(/\b(?:task\s+|tâche\s+)?(T\d+)\b/gi, (whole, n) => {
        const title = titles.get(n.toUpperCase());
        return title ? quote(title) : whole;
      });
  return {
    ...analysis,
    whatToDoNext: prose(analysis.whatToDoNext),
    overallInsight: prose(analysis.overallInsight),
    taskAnalysis: analysis.taskAnalysis
      .map(a => ({
        ...a, id: real(a?.id), dependencies: ids(a?.dependencies), relatedTasks: ids(a?.relatedTasks),
        reasoning: prose(a?.reasoning), relationshipNote: prose(a?.relationshipNote),
        actionPlan: Array.isArray(a?.actionPlan) ? a.actionPlan.map(prose) : a?.actionPlan,
      }))
      .filter(a => a.id),
  };
}

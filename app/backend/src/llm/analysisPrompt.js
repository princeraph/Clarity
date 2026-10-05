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

export function buildAnalysisPrompt(tasks) {
  const taskList = tasks.map((t, i) =>
    `Task ${shortName(i)}:\nTitle: ${t.title}\nDescription: ${(t.description || 'N/A').slice(0, 300)}\n` +
    `Deadline: ${t.deadline || 'None'}\nDeliverable: ${(t.deliverable || 'N/A').slice(0, 160)}\nStatus: ${t.status}\n` +
    `Tags: ${t.tags?.join(', ') || 'None'}\nRecurring: ${t.recurring || 'none'}\n` +
    `Subtasks: ${t.subtasks?.length ? t.subtasks.map(s => `${s.done ? '[done]' : '[todo]'} ${s.title}`).join(', ') : 'None'}\n` +
    `Notes: ${(t.notes || 'N/A').slice(0, 300)}`
  ).join('\n\n');

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

Rules: priority 1 = do first. priorityLevel = high/medium/low. Include all ${tasks.length} tasks. Write in the language the tasks are written in.`;

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

  return { text, schema, maxTokens: 180 + tasks.length * 70 };
}

// T-names back to real ids. Unknown names are dropped, never guessed.
export function restoreIds(analysis, tasks) {
  if (!analysis || !Array.isArray(analysis.taskAnalysis)) return analysis;
  const byName = new Map(tasks.map((t, i) => [shortName(i), t.id]));
  const real = n => byName.get(String(n).trim().toUpperCase());
  const ids = list => (Array.isArray(list) ? list : []).map(real).filter(Boolean);
  return {
    ...analysis,
    taskAnalysis: analysis.taskAnalysis
      .map(a => ({ ...a, id: real(a?.id), dependencies: ids(a?.dependencies), relatedTasks: ids(a?.relatedTasks) }))
      .filter(a => a.id),
  };
}

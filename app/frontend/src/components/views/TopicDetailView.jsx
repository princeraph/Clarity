import { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDeadline(dateStr) {
  const today = getTodayStr();
  const d = new Date(dateStr + 'T00:00:00');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
  if (dateStr < today) return 'Overdue';
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TaskRow({ task, onOpenDetail, T }) {
  const due = task.deadline ? formatDeadline(task.deadline) : null;
  const isOverdue = due === 'Overdue';
  const isDone = task.status === 'done';
  const meta = due || (task.estimatedDuration ? (task.estimatedDuration >= 60 ? `${Math.round(task.estimatedDuration / 60 * 10) / 10}h` : `${task.estimatedDuration}m`) : '');

  return (
    <div
      onClick={() => onOpenDetail?.(task)}
      style={{
        display: 'grid', gridTemplateColumns: '20px 1fr auto', alignItems: 'center', gap: 14,
        padding: '10px 4px', borderBottom: `1px solid ${T.hairlineSoft}`,
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.background = T.paperSubtle}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        border: `1.5px solid ${isDone ? T.done : T.ink40}`,
        background: isDone ? T.done : 'transparent',
        flexShrink: 0, position: 'relative',
      }}>
        {isDone && (
          <svg viewBox="0 0 10 10" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d="M2 5.5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </div>
      <span style={{
        fontSize: 14, color: isDone ? T.ink40 : T.ink,
        fontWeight: task.status === 'in_progress' ? 500 : 400,
        textDecoration: isDone ? 'line-through' : 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{task.title}</span>
      <span style={{
        fontFamily: T.fontMono, fontSize: 11,
        color: isOverdue ? T.danger : T.ink40,
        whiteSpace: 'nowrap',
      }}>{meta}</span>
    </div>
  );
}

function TaskGroup({ label, count, tasks, onOpenDetail, T }) {
  if (!tasks.length) return null;
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: T.ink, letterSpacing: '-0.005em' }}>{label}</h3>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>{count}</span>
      </div>
      {tasks.map(task => (
        <TaskRow key={task.id} task={task} onOpenDetail={onOpenDetail} T={T} />
      ))}
    </section>
  );
}

export default function TopicDetailView({ topic, allTasks, archivedTasks = [], onOpenDetail, onBack }) {
  const { T } = useTheme();
  const today = getTodayStr();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;

  const topicTasks = useMemo(() =>
    allTasks.filter(t => t.tags?.includes(topic) && !t.archived),
    [allTasks, topic]
  );

  const topicArchived = useMemo(() =>
    archivedTasks.filter(t => t.tags?.includes(topic)),
    [archivedTasks, topic]
  );

  const todayTasks = topicTasks.filter(t =>
    t.status !== 'done' && (t.status === 'in_progress' || (t.deadline && t.deadline <= today))
  );
  const upcomingTasks = topicTasks.filter(t =>
    t.status !== 'in_progress' && t.deadline && t.deadline > today
  );
  const anytimeTasks = topicTasks.filter(t =>
    t.status !== 'in_progress' && !t.deadline && t.status !== 'done'
  );
  const doneTasks = topicTasks.filter(t => t.status === 'done');

  const totalActive = topicTasks.filter(t => t.status !== 'done').length;
  const doneCount = doneTasks.length;
  const total = topicTasks.length;
  const pct = total > 0 ? (doneCount / total) * 100 : 0;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '36px 56px', fontFamily: T.fontUI, boxSizing: 'border-box' }}>
      {/* Header */}
      <header style={{ marginBottom: 28 }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: 16,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: T.ink40,
            padding: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 2L4 6l3.5 4" stroke={T.ink40} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Topics
        </button>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>Topic</div>
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: 500, letterSpacing: '-0.035em', color: T.ink }}>{topic}</h1>
      </header>

      {/* Progress summary strip */}
      {total > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center',
          padding: '14px 18px', marginBottom: 28,
          background: T.paperSubtle,
          border: `1px solid ${T.hairline}`, borderRadius: T.r10,
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: T.ink80 }}>Progress</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.ink60 }}>{doneCount} of {total} done</span>
            </div>
            <div style={{ height: 6, background: T.paperMuted, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: T.done, borderRadius: 999, transition: 'width 600ms ease' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Today',    value: todayTasks.length    },
              { label: 'Upcoming', value: upcomingTasks.length },
              { label: 'Anytime',  value: anytimeTasks.length  },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em', color: T.ink }}>{s.value}</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink40, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task groups */}
      {total === 0 && topicArchived.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <p style={{ fontSize: 14, color: T.ink60 }}>No tasks in this topic yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <TaskGroup label="Today"    count={todayTasks.length}    tasks={todayTasks}    onOpenDetail={onOpenDetail} T={T} />
          <TaskGroup label="Upcoming" count={upcomingTasks.length} tasks={upcomingTasks} onOpenDetail={onOpenDetail} T={T} />
          <TaskGroup label="Anytime"  count={anytimeTasks.length}  tasks={anytimeTasks}  onOpenDetail={onOpenDetail} T={T} />
          <TaskGroup label="Done"     count={doneCount}            tasks={doneTasks}     onOpenDetail={onOpenDetail} T={T} />
          {topicArchived.length > 0 && (
            <TaskGroup label="Archive" count={topicArchived.length} tasks={topicArchived} onOpenDetail={onOpenDetail} T={T} />
          )}
        </div>
      )}
    </div>
  );
}

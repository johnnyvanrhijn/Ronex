import { useMemo } from 'react';
import type { TasksData, Task } from '../lib/api';
import { phaseProgress } from '../lib/api';
import { TaskCard } from '../components/TaskCard';

interface Props {
  data: TasksData;
  filterOwner: string | null;
  filterPhase: string | null;
  onTaskClick: (t: Task) => void;
  onAddTaskClick: (phaseOrder: number) => void;
}

export function ListView({
  data,
  filterOwner,
  filterPhase,
  onTaskClick,
  onAddTaskClick,
}: Props) {
  const allTasks = useMemo(
    () => data.phases.flatMap((p) => p.tasks),
    [data]
  );

  const phasesToShow = data.phases.filter((p) => {
    if (filterPhase && p.id !== filterPhase) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {phasesToShow.map((phase) => {
        const visibleTasks = phase.tasks.filter((t) => {
          if (filterOwner && t.owner !== filterOwner) return false;
          return true;
        });
        const p = phaseProgress(phase);

        return (
          <div key={phase.id} className="card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="font-mono text-xs text-ink-500 tabular-nums">
                  {String(phase.order).padStart(2, '0')}
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {phase.name}
                </h3>
                <div className="font-mono text-xs text-ink-500">
                  {p.done}/{p.total} · {p.percent}%
                </div>
              </div>
              <button
                onClick={() => onAddTaskClick(phase.order)}
                className="btn btn-ghost text-xs font-mono uppercase tracking-wider"
              >
                + Add task
              </button>
            </div>

            {phase.goal && (
              <div className="text-sm text-ink-500 mb-3 italic">
                Goal: {phase.goal}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {visibleTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  allTasks={allTasks}
                  onClick={() => onTaskClick(task)}
                />
              ))}
              {visibleTasks.length === 0 && (
                <div className="col-span-full text-center text-ink-500 text-sm py-6 italic">
                  No tasks match the current filters
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

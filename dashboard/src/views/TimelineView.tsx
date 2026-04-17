import { useMemo } from 'react';
import type { TasksData, Task } from '../lib/api';
import { phaseProgress } from '../lib/api';
import { OWNER_META, STATUS_META } from '../lib/meta';

interface Props {
  data: TasksData;
  filterOwner: string | null;
  onTaskClick: (t: Task) => void;
}

export function TimelineView({ data, filterOwner, onTaskClick }: Props) {
  const allTasks = useMemo(
    () => data.phases.flatMap((p) => p.tasks),
    [data]
  );

  return (
    <div className="card p-6 overflow-x-auto">
      <div className="min-w-[900px]">
        {data.phases.map((phase, idx) => {
          const p = phaseProgress(phase);
          const visibleTasks = phase.tasks.filter((t) => {
            if (filterOwner && t.owner !== filterOwner) return false;
            return true;
          });
          if (visibleTasks.length === 0) return null;

          return (
            <div key={phase.id} className="mb-6 last:mb-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="font-mono text-xs text-ink-500 tabular-nums w-6">
                  {String(phase.order).padStart(2, '0')}
                </div>
                <h3 className="font-display font-semibold text-base">
                  {phase.name}
                </h3>
                <div className="flex-1 h-px bg-ink-700" />
                <div className="font-mono text-xs text-ink-500">
                  Week {idx === 0 ? '1' : `${idx + 1}+`}
                </div>
                <div className="font-mono text-xs text-ink-500">
                  {p.done}/{p.total}
                </div>
              </div>

              <div className="ml-9 space-y-1">
                {visibleTasks.map((task) => {
                  const owner = OWNER_META[task.owner];
                  const status = STATUS_META[task.status];
                  const hasDeps = task.dependencies && task.dependencies.length > 0;
                  const isDone = task.status === 'done';
                  const isBlocked = task.status === 'blocked';

                  return (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`w-full text-left flex items-center gap-3 py-1.5 px-3 -mx-3 rounded-md hover:bg-ink-800/60 transition-colors group ${
                        isDone ? 'opacity-50' : ''
                      }`}
                    >
                      <span className={`text-sm w-4 ${owner.color}`}>{owner.symbol}</span>
                      <span className="font-mono text-[10px] text-ink-500 w-12 tabular-nums">
                        {task.id}
                      </span>
                      <span
                        className={`flex-1 text-sm font-medium ${
                          isDone ? 'line-through text-ink-500' : 'text-bone-50'
                        } group-hover:text-lime-400 transition-colors`}
                      >
                        {task.title}
                      </span>
                      {hasDeps && (
                        <span className="font-mono text-[10px] text-ink-500">
                          ↳ {task.dependencies!.join(', ')}
                        </span>
                      )}
                      {task.estimateHours && (
                        <span className="font-mono text-[10px] text-ink-500 w-10 text-right">
                          ~{task.estimateHours}h
                        </span>
                      )}
                      <span
                        className={`pill ring-1 ring-ink-700 ${status.color} bg-ink-800 w-24 justify-center`}
                      >
                        {status.label.toLowerCase()}
                      </span>
                      {isBlocked && (
                        <span className="text-ruby-500 text-xs">⚠</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

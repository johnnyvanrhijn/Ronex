import type { TasksData, Task } from '../lib/api';
import { phaseProgress } from '../lib/api';
import { OWNER_META, PRIORITY_META } from '../lib/meta';

interface Props {
  data: TasksData;
  suggested: Task[];
  onTaskClick: (t: Task) => void;
}

export function Cockpit({ data, suggested, onTaskClick }: Props) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Phases overview */}
      <div className="lg:col-span-2 card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-500">
            Phases
          </h2>
          <div className="font-mono text-[10px] text-ink-500 tracking-widest">
            {data.phases.length} TOTAL
          </div>
        </div>
        <div className="space-y-2">
          {data.phases.map((phase) => {
            const p = phaseProgress(phase);
            const isCurrent = p.percent < 100 && p.done > 0;
            const isComplete = p.percent === 100;
            const isFuture = p.done === 0;

            return (
              <div
                key={phase.id}
                className={`group flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg ${
                  isCurrent ? 'bg-ink-700/30' : 'hover:bg-ink-800/50'
                } transition-colors`}
              >
                <div className="font-mono text-xs text-ink-500 w-6 tabular-nums">
                  {String(phase.order).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-display font-medium text-sm ${
                        isComplete
                          ? 'text-ink-500 line-through'
                          : isCurrent
                          ? 'text-bone-50'
                          : 'text-bone-200'
                      }`}
                    >
                      {phase.name}
                    </span>
                    {isCurrent && (
                      <span className="pill bg-lime-400/10 text-lime-400 ring-1 ring-lime-400/30">
                        ● ACTIVE
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-32 h-1.5 bg-ink-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isComplete ? 'bg-ink-600' : isCurrent ? 'bg-lime-400' : 'bg-ink-700'
                    }`}
                    style={{ width: `${p.percent}%` }}
                  />
                </div>
                <div className="font-mono text-xs text-ink-500 w-14 text-right tabular-nums">
                  {p.done}/{p.total}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested next */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-500">
            Up next
          </h2>
          <div className="font-mono text-[10px] text-lime-400 tracking-widest">
            ✦ SUGGESTED
          </div>
        </div>
        {suggested.length === 0 ? (
          <div className="py-8 text-center text-ink-500 text-sm">
            Nothing unblocked. <br />
            <span className="text-xs">Resolve dependencies first.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {suggested.map((task) => {
              const owner = OWNER_META[task.owner];
              const prio = task.priority ? PRIORITY_META[task.priority] : null;
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="w-full text-left p-3 rounded-lg bg-ink-900 hover:bg-ink-800/80 border border-ink-800 hover:border-ink-700 transition-all group"
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-xs ${owner.color} mt-0.5 shrink-0`}>
                      {owner.symbol}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-medium text-sm leading-snug text-bone-50 group-hover:text-lime-400 transition-colors">
                        {task.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="font-mono text-[10px] text-ink-500">{task.id}</span>
                        {prio && task.priority !== 'normal' && (
                          <span className={`font-mono text-[10px] ${prio.color}`}>
                            {prio.label.toUpperCase()}
                          </span>
                        )}
                        {task.estimateHours && (
                          <span className="font-mono text-[10px] text-ink-500">
                            ~{task.estimateHours}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
